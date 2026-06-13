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

// Single Nominatim lookup → { lat, lng } | null.
async function nominatimLookup(q) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      q
    )}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "ebay-lister-sourcing/1.0 (store map geocoding)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) return null;
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

// Strip unit/suite designators that commonly break geocoding. Real example:
// "2229 NW 138th St B" — Nominatim matches "138th St" but NOT "138th St B"
// (the "B" is the unit). Handles explicit designators (Ste/Suite/Unit/Apt/
// #/Bldg/Fl…) and a bare short token trailing a street-suffix word before a
// comma. Only used as a fallback, so normal addresses are unaffected.
function stripUnit(address) {
  let s = address;
  s = s.replace(
    /[\s,]+(?:ste|suite|unit|apt|apartment|rm|room|bldg|building|fl|floor|#)\s*\.?\s*[a-z0-9-]+/gi,
    ""
  );
  s = s.replace(
    /(\b(?:st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane|ct|court|way|pl|place|pkwy|parkway|hwy|highway|cir|circle|ter|terrace|trl|trail))\.?\s+[a-z0-9]{1,3}(?=\s*,)/i,
    "$1"
  );
  return s.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").trim();
}

// Geocode a free-text address to { lat, lng } using OpenStreetMap's free
// Nominatim service (no API key). Tries the full address first (best
// accuracy); if that finds nothing, retries once with unit/suite
// designators stripped. Best-effort — returns null on total failure. Runs
// server-side so we can set the User-Agent Nominatim's policy asks for.
export async function geocodeAddress(address) {
  if (!address || !address.trim()) return null;
  const full = address.trim();

  let result = await nominatimLookup(full);
  if (result) return result;

  const stripped = stripUnit(full);
  if (stripped && stripped !== full) {
    await new Promise((r) => setTimeout(r, 1100)); // be polite to Nominatim
    result = await nominatimLookup(stripped);
    if (result) return result;
  }
  return null;
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
