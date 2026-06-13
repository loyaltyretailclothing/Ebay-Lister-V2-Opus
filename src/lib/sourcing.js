import cloudinary from "@/lib/cloudinary";

// Sourcing data (stores + trips) is stored as a single raw JSON blob in
// Cloudinary — the same pattern as settings/drafts, but at its OWN distinct
// public_id so it never collides with that data. Low volume (a handful of
// stores, dozens-to-hundreds of trips) so load-all / save-all is fine.
//
// Shape:
//   {
//     stores: [{ id, name, address, lat?, lng?, createdAt }],
//     trips:  [{ id, storeId, date, bb, medium, high, createdAt }]
//   }
// lat/lng are reserved for the Phase 2 map (geocoded on store add).
const SOURCING_PUBLIC_ID = "ebay-listings/config/sourcing";

function normalize(data) {
  return {
    stores: Array.isArray(data?.stores) ? data.stores : [],
    trips: Array.isArray(data?.trips) ? data.trips : [],
  };
}

export async function loadSourcing() {
  const url = cloudinary.url(SOURCING_PUBLIC_ID, {
    resource_type: "raw",
    secure: true,
    version: Date.now(), // cache-bust so we always read the latest
  });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { stores: [], trips: [] }; // 404 = nothing saved yet
  try {
    return normalize(await res.json());
  } catch {
    return { stores: [], trips: [] };
  }
}

export async function saveSourcing(data) {
  const payload = normalize(data);
  const jsonStr = JSON.stringify(payload);
  const dataUri = `data:application/json;base64,${Buffer.from(jsonStr).toString("base64")}`;
  await cloudinary.uploader.upload(dataUri, {
    public_id: SOURCING_PUBLIC_ID,
    resource_type: "raw",
    overwrite: true,
    invalidate: true,
  });
  return payload;
}
