import { NextResponse } from "next/server";
import { loadSourcing, saveSourcing, geocodeAddress } from "@/lib/sourcing";

// GET /api/sourcing — return all stores + trips.
export async function GET() {
  try {
    const data = await loadSourcing();
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("Sourcing load error:", error);
    // Soft-fail to empty so the page still renders.
    return NextResponse.json({ success: true, stores: [], trips: [] });
  }
}

// POST /api/sourcing — save the full stores + trips payload (load-all /
// save-all; the client mutates in memory and posts the whole thing).
export async function POST(request) {
  try {
    const body = await request.json();
    const stores = Array.isArray(body.stores) ? body.stores : [];
    const trips = Array.isArray(body.trips) ? body.trips : [];

    // Geocode any store that has an address but no coordinates yet
    // (new stores, or ones whose address changed — the client clears the
    // old coords on edit). Best-effort and sequential to stay within
    // Nominatim's ~1-request/second usage policy; failures just leave the
    // store unmapped (still shows in the list).
    for (const s of stores) {
      const hasCoords =
        typeof s.lat === "number" && typeof s.lng === "number";
      if (!hasCoords && s.address && s.address.trim()) {
        const geo = await geocodeAddress(s.address);
        if (geo) {
          s.lat = geo.lat;
          s.lng = geo.lng;
        }
      }
    }

    const saved = await saveSourcing({ stores, trips });
    return NextResponse.json({ success: true, ...saved });
  } catch (error) {
    console.error("Sourcing save error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
