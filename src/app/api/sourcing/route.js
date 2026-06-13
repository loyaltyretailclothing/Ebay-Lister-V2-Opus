import { NextResponse } from "next/server";
import { loadSourcing, saveSourcing } from "@/lib/sourcing";

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
    const saved = await saveSourcing({ stores: body.stores, trips: body.trips });
    return NextResponse.json({ success: true, ...saved });
  } catch (error) {
    console.error("Sourcing save error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
