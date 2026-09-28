import { NextResponse } from "next/server";
import { isDraftId, newDraftId, saveDraft } from "@/lib/drafts";
import { newTally, visionRequest } from "@/lib/listingPipeline";
import { analyzeDraftLive } from "@/lib/runAnalysis";
import { submitOne } from "@/lib/batchAnalyze";
import { buildAiEntry, buildCameraEntry, cleanCameraTiming } from "@/lib/efficiency";
import { writeEntry } from "@/lib/efficiencyLog";

// Efficiency Tracker: write (or update) this camera session's entry.
// Best-effort — a failed log never affects the draft.
async function logCamera(timing, draftId, category, categoryId) {
  const entry = buildCameraEntry({ timing, draftId, category, categoryId });
  if (!entry) return;
  try {
    await writeEntry(entry);
  } catch (err) {
    console.error("Efficiency camera log failed:", err);
  }
}

// What this analysis cost, from the token counts Anthropic already sent
// back. Also best-effort — cost bookkeeping never breaks a draft.
async function logCost(tally, draftId, category, categoryId) {
  const entry = buildAiEntry({ tally, source: "camera", draftId, category, categoryId });
  if (!entry) return;
  try {
    await writeEntry(entry);
  } catch (err) {
    console.error("AI cost log failed:", err);
  }
}

// Pipeline takes ~30-60s (Claude vision + eBay + Claude pass 2 + optional
// Brave refine). Vercel default is 10s on Hobby / 60s on Pro; push to 60s so
// we can accommodate the full run.
export const maxDuration = 60;

// POST /api/drafts/process
//
// Body:
//   {
//     listingPhotos: [{ secure_url, public_id, ... }, ...],  // already uploaded to Cloudinary
//     aiPhotoIndices: [0, 3, 5],                              // which photos to analyze
//     notes?: "optional"
//   }
//
// The caller should fire-and-forget this request — the UI shouldn't block on
// the response. A `processing` draft is written immediately so the Drafts
// list reflects the in-flight job. When the pipeline finishes the same
// draftId is re-saved as `ready` (or `error`, with photos preserved).
export async function POST(request) {
  let draftId = null;
  let listingPhotos = [];
  let aiPhotos = [];
  let aiNote = "";
  let draftNote = "";
  let timing = null;
  // Adds up what every pass of this run cost (see logCost below).
  const tally = newTally();

  try {
    const body = await request.json();
    // Prefer the client-supplied draft id so a retried request (this POST is
    // fire-and-forget and the client navigates away mid-flight, prompting a
    // platform-level retry) overwrites the SAME draft instead of creating a
    // duplicate. Validate it as a safe Cloudinary public_id; otherwise fall
    // back to a server-generated id.
    draftId = isDraftId(body.draftId) ? body.draftId : newDraftId();
    listingPhotos = Array.isArray(body.listingPhotos) ? body.listingPhotos : [];
    const aiIndices = Array.isArray(body.aiPhotoIndices) ? body.aiPhotoIndices : [];
    aiPhotos = aiIndices
      .map((i) => listingPhotos[i])
      .filter(Boolean);
    // aiNote is the hint fed to Claude during analysis; draftNote is the
    // internal note that the AI never sees. Both get attached to the saved
    // listing so they persist and show up when the draft is opened. Accept
    // legacy `notes` as a fallback for the aiNote.
    aiNote = body.aiNote || body.notes || "";
    draftNote = body.draftNote || "";
    // Efficiency Tracker (camera tracker): active shooting / review time.
    timing = cleanCameraTiming(body.timing);
    // Queue it with Anthropic (half price, answers later) rather than
    // waiting on the line. The camera asks for this; "Analyze now" doesn't.
    const queued = body.queued === true;

    if (listingPhotos.length === 0) {
      return NextResponse.json(
        { success: false, error: "No listing photos provided" },
        { status: 400 }
      );
    }

    const analysisPhotos = aiPhotos.length > 0 ? aiPhotos : listingPhotos.slice(0, 3);

    // 1a. Queued: hand the photos to Anthropic's batch queue (half price)
    //     and stop here. The draft sits in the list showing its phase until
    //     a browser tab or the morning cron collects the answer — see
    //     src/lib/batchCollect.js. Timing is saved on the draft because the
    //     camera entry can only get its category once the answer comes back.
    if (queued) {
      const batchId = await submitOne(visionRequest(analysisPhotos, aiNote), `${draftId}-vision`);
      await saveDraft(draftId, {
        id: draftId,
        listing: { aiNote, draftNote },
        aiPhotos,
        listingPhotos,
        timing,
        status: "queued",
        batch: { id: batchId, phase: 1, at: new Date().toISOString() },
        savedAt: new Date().toISOString(),
      });
      await logCamera(timing, draftId);
      return NextResponse.json({ success: true, draftId, queued: true });
    }

    // 1b. Live: write the processing record immediately so the Drafts tab
    //     shows it the moment the client fires this request.
    await saveDraft(draftId, {
      id: draftId,
      listing: { aiNote, draftNote },
      aiPhotos,
      listingPhotos,
      status: "processing",
      savedAt: new Date().toISOString(),
    });
    // Camera entry now (no category yet); updated with the category below.
    await logCamera(timing, draftId);

    // 2. Run the whole analysis on the spot (shared with "Analyze now" and
    //    the fallback when the queue lets a draft down).
    const listing = await analyzeDraftLive({ analysisPhotos, aiNote, draftNote, tally });

    await logCamera(timing, draftId, listing.categoryName, listing.categoryId);
    await logCost(tally, draftId, listing.categoryName, listing.categoryId);

    // 6. Save the completed draft.
    await saveDraft(draftId, {
      id: draftId,
      listing,
      aiPhotos,
      listingPhotos,
      status: "ready",
      savedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, draftId });
  } catch (error) {
    console.error("Draft processing error:", error);
    // body parsing may have failed before draftId was assigned.
    if (!draftId) draftId = newDraftId();
    // Whatever ran before it broke was still charged — record it, or the
    // tracker would quietly understate what the month cost.
    await logCost(tally, draftId);
    // Preserve photos + surface the error on the draft row so the user can
    // see what went wrong and either retry or finish manually.
    try {
      await saveDraft(draftId, {
        id: draftId,
        listing: { aiNote, draftNote },
        aiPhotos,
        listingPhotos,
        status: "error",
        errorMessage: (error.message || "Processing failed").slice(0, 255),
        savedAt: new Date().toISOString(),
      });
    } catch (saveErr) {
      console.error("Failed to persist error draft:", saveErr);
    }
    return NextResponse.json(
      { success: false, draftId, error: error.message },
      { status: 500 }
    );
  }
}
