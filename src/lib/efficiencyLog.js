import cloudinary from "./cloudinary";
import { cleanEntry } from "./efficiency";

// Efficiency Tracker log — ONE small raw file per listed item in Cloudinary.
// Add-only: a new file is written for every entry and nothing is ever
// overwritten, so two people listing at once can't clobber each other (the
// whole-file overwrite that lost the category settings can't happen here).
// Every field is also mirrored into the file's context metadata, so the
// report reads the whole log with one list call instead of downloading
// each file.

const LOG_FOLDER = "ebay-listings/logs/efficiency";

export async function writeEntry(entry) {
  const clean = cleanEntry(entry);
  if (!clean) throw new Error("Invalid efficiency entry");
  const id = `eff_${Date.parse(clean.listedAt)}_${Math.random().toString(36).slice(2, 8)}`;
  const context = Object.fromEntries(
    Object.entries(clean).map(([k, v]) => [k, String(v).replace(/[|=]/g, " ")])
  );
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: LOG_FOLDER,
        public_id: id,
        overwrite: false,
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
  return entries.sort((a, b) => (a.listedAt < b.listedAt ? -1 : 1));
}
