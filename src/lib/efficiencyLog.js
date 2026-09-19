import cloudinary from "./cloudinary";
import { cleanEntry, entryId } from "./efficiency";

// Efficiency Tracker log — ONE small raw file per event in Cloudinary
// (a camera session, or a draft being listed). Each file has its own stable
// id (camera_<draftId> / draft_<listingId>), so nothing ever overwrites a
// different entry — two people working at once can't clobber each other,
// and a retried request just rewrites its own entry instead of doubling it.
// Every field is mirrored into the file's context metadata, so the report
// reads the whole log with one list call.

const LOG_FOLDER = "ebay-listings/logs/efficiency";

export async function writeEntry(entry) {
  const clean = cleanEntry(entry);
  if (!clean) throw new Error("Invalid efficiency entry");
  const context = Object.fromEntries(
    Object.entries(clean).map(([k, v]) => [k, String(v).replace(/[|=]/g, " ")])
  );
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: LOG_FOLDER,
        public_id: entryId(clean),
        overwrite: true,
        context,
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(Buffer.from(JSON.stringify(clean), "utf8"));
  });
}

// Every entry, oldest first.
export async function listEntries() {
  const entries = [];
  let cursor;
  do {
    const result = await cloudinary.api.resources({
      resource_type: "raw",
      type: "upload",
      prefix: `${LOG_FOLDER}/`,
      max_results: 500,
      context: true,
      ...(cursor ? { next_cursor: cursor } : {}),
    });
    for (const r of result.resources || []) {
      const e = cleanEntry(r.context?.custom);
      if (e) entries.push(e);
    }
    cursor = result.next_cursor;
  } while (cursor);
  return entries.sort((a, b) => (a.at < b.at ? -1 : 1));
}
