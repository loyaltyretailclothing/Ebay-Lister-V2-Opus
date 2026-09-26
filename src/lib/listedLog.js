import cloudinary from "./cloudinary";

// Listed report — one small record per item that reaches eBay, written at
// posting time. It has to live outside the draft, because the draft is
// deleted the moment the item posts (and a held item posts months after it
// was finished). See docs/Plans/Listed Report Plan.md.
//
// The photo is eBay's own image URL, so the record keeps working after the
// Cloudinary photos are cleared out.

const LOG_FOLDER = "ebay-listings/logs/listed";

export function cleanListed(e) {
  if (!e || typeof e !== "object") return null;
  const at = Date.parse(e.at);
  const listingId = String(e.listingId || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 30);
  if (!Number.isFinite(at) || !listingId) return null;
  const cost = Number(String(e.cost ?? "").replace(/[^0-9.]/g, ""));
  return {
    at: new Date(at).toISOString(),
    listingId,
    title: String(e.title || "Untitled").slice(0, 200),
    sku: String(e.sku || "").slice(0, 60),
    cost: Number.isFinite(cost) && cost >= 0 ? Math.round(cost * 100) / 100 : null,
    place: String(e.place || "").slice(0, 120),
    image: String(e.image || "").slice(0, 400),
    url: String(e.url || (listingId ? `https://www.ebay.com/itm/${listingId}` : "")).slice(0, 400),
    held: e.held === true || e.held === "true",
  };
}

export async function writeListed(entry) {
  const clean = cleanListed(entry);
  if (!clean) throw new Error("Invalid listed record");
  const context = Object.fromEntries(
    Object.entries(clean).map(([k, v]) => [k, String(v ?? "").replace(/[|=]/g, " ")])
  );
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: LOG_FOLDER,
        // One record per listing — a retry rewrites its own record.
        public_id: `listed_${clean.listingId}`,
        overwrite: true,
        context,
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(Buffer.from(JSON.stringify(clean), "utf8"));
  });
}

// Take rows off the report once their details are in Flipwise. Only the
// record goes — the eBay listing is untouched.
export async function deleteListed(listingIds) {
  const ids = (listingIds || [])
    .map((id) => String(id).replace(/[^0-9A-Za-z_-]/g, ""))
    .filter(Boolean)
    .map((id) => `${LOG_FOLDER}/listed_${id}`);
  if (!ids.length) return 0;
  for (let i = 0; i < ids.length; i += 100) {
    await cloudinary.api.delete_resources(ids.slice(i, i + 100), { resource_type: "raw" });
  }
  return ids.length;
}

// Everything listed, newest first.
export async function listListed() {
  const out = [];
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
      const e = cleanListed(r.context?.custom);
      if (e) out.push(e);
    }
    cursor = result.next_cursor;
  } while (cursor);
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}
