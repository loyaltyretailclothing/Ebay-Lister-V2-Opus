import { NextResponse } from "next/server";
import { deleteDraft, getDraft, listDrafts, saveDraft } from "@/lib/drafts";
import { writeRun } from "@/lib/holdRuns";
import { writeEntry } from "@/lib/efficiencyLog";
import { buildDraftEntry } from "@/lib/efficiency";

// Seasonal Hold — the posting morning. Runs at 7am Central (see vercel.json:
// two daily wake-ups, 12:00 and 13:00 UTC; this skips the one that isn't
// 7am local, so daylight saving doesn't drift it to 6am).
//
// Posts every held draft whose day has come, in batches of BATCH, chaining
// straight into the next batch so a big fall release finishes in one
// morning. Anything that can't post goes back to the drafts queue marked
// with the reason — it is never posted half-finished.
// See docs/Plans/Seasonal Hold Plan.md.

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BATCH = 20;
const DAILY_MAX = 300; // backstop, in case something ever goes wrong
const ZONE = "America/Chicago";

// Today's date (YYYY-MM-DD) where the users live.
function localToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function localHour() {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: ZONE, hour: "numeric", hour12: false }).format(
      new Date()
    )
  );
}

function siteUrl(request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (env) return env.startsWith("http") ? env : `https://${env}`;
  return new URL(request.url).origin;
}

// Everything needed before we're allowed to post it.
function whatsMissing(listing, photos) {
  const missing = [];
  if (!listing?.title?.trim()) missing.push("title");
  if (!listing?.categoryId) missing.push("category");
  if (!listing?.price) missing.push("price");
  if (!String(listing?.sku || "").trim()) missing.push("SKU");
  if (!photos?.length) missing.push("photos");
  return missing;
}

export async function GET(request) {
  // Vercel sends this header on scheduled runs; CRON_SECRET (set by the
  // users in Vercel) keeps anyone else from triggering a posting morning.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  const fromVercel = request.headers.get("x-vercel-cron");
  if (secret && auth !== `Bearer ${secret}` && !fromVercel) {
    return NextResponse.json({ success: false, error: "Not allowed" }, { status: 401 });
  }

  const url = new URL(request.url);
  const batchNo = parseInt(url.searchParams.get("batch"), 10) || 1;
  const force = url.searchParams.get("force") === "1";

  // Only the wake-up that lands at 7-8am local actually posts, so a stray
  // call in the middle of the day can't start a posting morning.
  const hour = localHour();
  if (!force && (hour < 7 || hour > 8)) {
    return NextResponse.json({ success: true, skipped: `not posting time (${hour}:00 local)` });
  }
  if (batchNo * BATCH > DAILY_MAX) {
    return NextResponse.json({ success: true, stopped: "daily maximum reached" });
  }

  const today = localToday();
  const drafts = await listDrafts();
  const due = drafts
    .filter((d) => d.holdUntil && d.holdUntil <= today && d.status !== "processing")
    .sort((a, b) => (a.holdUntil < b.holdUntil ? -1 : 1));

  const batch = due.slice(0, BATCH);
  const posted = [];
  const problems = [];
  let value = 0;

  for (const row of batch) {
    try {
      const draft = await getDraft(row.id);
      if (!draft) continue;
      const listing = draft.listing || {};
      const photos = draft.listingPhotos || [];
      const missing = whatsMissing(listing, photos);
      if (missing.length) throw new Error(`Missing ${missing.join(", ")}`);

      // The same publish path (and SKU check) as List on eBay.
      const res = await fetch(`${siteUrl(request)}/api/ebay/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...listing, photos }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "eBay rejected the listing");

      await deleteDraft(row.id);
      posted.push({ id: row.id, title: row.title, listingId: data.listingId });
      value += Number(listing.price) || 0;

      // Efficiency Tracker: the draft was finished earlier; log it as listed
      // today so the Track tab counts it.
      try {
        await writeEntry(
          buildDraftEntry({
            listing,
            finishMs: listing.timing?.finishMs,
            analyses: listing.timing?.analyses,
            listingId: data.listingId,
            listedAt: new Date().toISOString(),
          })
        );
      } catch (logErr) {
        console.error("Efficiency log failed for held draft:", logErr);
      }
    } catch (err) {
      // Back into the drafts queue with the reason — never posted broken.
      problems.push(`${row.title}: ${err.message}`);
      try {
        const draft = await getDraft(row.id);
        if (draft) {
          await saveDraft(row.id, {
            ...draft,
            listing: { ...(draft.listing || {}), holdUntil: "", holdSeason: "" },
            status: "error",
            errorMessage: `Couldn't post automatically — ${err.message}`.slice(0, 255),
          });
        }
      } catch (saveErr) {
        console.error("Could not mark held draft as failed:", saveErr);
      }
    }
  }

  const more = due.length - batch.length;
  const run = {
    at: new Date().toISOString(),
    batch: batchNo,
    posted: posted.length,
    failed: problems.length,
    value: Math.round(value * 100) / 100,
    problems: problems.join(" | "),
  };
  if (posted.length || problems.length) {
    try {
      await writeRun(run);
    } catch (err) {
      console.error("Could not write the hold run log:", err);
    }
  }

  // Straight into the next batch (fire and forget) so a big release day
  // finishes without waiting for tomorrow.
  if (more > 0) {
    const next = `${siteUrl(request)}/api/cron/post-held?batch=${batchNo + 1}${force ? "&force=1" : ""}`;
    fetch(next, {
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    }).catch((err) => console.error("Next hold batch kickoff failed:", err));
  }

  return NextResponse.json({ success: true, ...run, remaining: more });
}
