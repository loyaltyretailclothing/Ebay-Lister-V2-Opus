import cloudinary from "./cloudinary";

// Held items: once the listing is live on eBay, its photos aren't needed any
// more (eBay keeps its own copies, and the Listed report points at eBay's
// image). Half an hour after posting they're deleted from Cloudinary.
//
// Nothing on the server can count down half an hour — a request answers and
// the function ends — so posting only writes down WHEN the photos are due.
// The sweep below does the deleting, and is called by whatever comes along
// first: an open browser tab (see PhotoSweeper), a listing posted by hand,
// or the next daily cron wake-up. So the delay is a floor, never a timer.
//
// See docs/Plans/Seasonal Hold Plan.md.

const SWEEP_FOLDER = "ebay-listings/logs/photo-sweep";
const PHOTO_FOLDER = "ebay-listings/"; // nothing outside it may ever be deleted
const MAX_PER_SWEEP = 100; // records per run, so nothing can ever run away

export const SWEEP_DELAY_MS = 30 * 60 * 1000;

export function dueTime(now = Date.now()) {
  return new Date(now + SWEEP_DELAY_MS).toISOString();
}

// Write down a draft's photos and the time they may be deleted. One record
// per draft; the photos keep their `heldDraft` mark until then, so they stay
// out of the Photo Library for the whole wait rather than briefly reappearing.
export async function schedulePhotoDelete(key, publicIds, dueAt = dueTime()) {
  const ids = [...new Set((publicIds || []).filter(Boolean))].filter((id) =>
    String(id).startsWith(PHOTO_FOLDER)
  );
  if (!ids.length) return null;
  const id = `sweep_${String(key || Date.now()).replace(/[^0-9A-Za-z_-]/g, "").slice(0, 60)}`;
  const body = { dueAt, ids };
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: SWEEP_FOLDER,
        public_id: id,
        overwrite: true,
        // The due time is on the record itself, so a sweep can see what is
        // due without downloading anything.
        context: { dueAt, count: String(ids.length) },
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(Buffer.from(JSON.stringify(body), "utf8"));
  });
}

// Split the records into what may go now and when the next one is due.
export function splitDue(records, now = Date.now()) {
  const due = [];
  let nextDueAt = null;
  for (const r of records || []) {
    const at = Date.parse(r.dueAt);
    if (!Number.isFinite(at)) continue; // no readable time — leave it alone
    if (at <= now) due.push(r);
    else if (!nextDueAt || at < Date.parse(nextDueAt)) nextDueAt = r.dueAt;
  }
  return { due: due.slice(0, MAX_PER_SWEEP), nextDueAt };
}

async function pendingRecords() {
  const out = [];
  let cursor;
  do {
    const result = await cloudinary.api.resources({
      resource_type: "raw",
      type: "upload",
      prefix: `${SWEEP_FOLDER}/`,
      max_results: 500,
      context: true,
      ...(cursor ? { next_cursor: cursor } : {}),
    });
    for (const r of result.resources || []) {
      out.push({
        publicId: r.public_id,
        url: r.secure_url,
        dueAt: r.context?.custom?.dueAt || "",
      });
    }
    cursor = result.next_cursor;
  } while (cursor);
  return out;
}

async function destroyRecord(publicId) {
  await cloudinary.uploader.destroy(publicId, { resource_type: "raw", invalidate: true });
}

// Delete every photo whose half hour is up. Returns how many went and when
// the next lot is due, so an open tab knows exactly when to come back.
export async function sweepPhotos(now = Date.now()) {
  const { due, nextDueAt } = splitDue(await pendingRecords(), now);
  let deleted = 0;

  for (const record of due) {
    let ids = [];
    try {
      const res = await fetch(record.url, { cache: "no-store" });
      if (res.status === 404) {
        await destroyRecord(record.publicId); // record itself is gone
        continue;
      }
      if (!res.ok) throw new Error(`Couldn't read the record: ${res.status}`);
      const body = await res.json();
      // Only ever photos, and only ever ours.
      ids = (body.ids || []).filter((id) => String(id).startsWith(PHOTO_FOLDER));
    } catch (err) {
      console.error("Photo sweep: skipping a record —", err.message);
      continue; // try again next time rather than guess
    }
    try {
      for (let i = 0; i < ids.length; i += 100) {
        await cloudinary.api.delete_resources(ids.slice(i, i + 100));
      }
      deleted += ids.length;
      await destroyRecord(record.publicId);
    } catch (err) {
      console.error("Photo sweep: delete failed —", err.message);
    }
  }

  return { deleted, records: due.length, nextDueAt };
}
