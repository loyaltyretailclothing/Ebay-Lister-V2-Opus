import { NextResponse } from "next/server";
import { refineStyleName } from "@/lib/listingPipeline";

// POST /api/generate/refine
//
// Thin wrapper — Brave search + prompt + title rebuild all live in
// listingPipeline.js. `refineStyleName` returns either a merge object
// ({ title?, observations? }) or null when nothing was found.
export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const { listing } = await request.json();
    const merge = await refineStyleName(listing);

    // The Generate page treats `listing: null` as "no style name found".
    return NextResponse.json({ success: true, listing: merge });
  } catch (error) {
    console.error("Refine error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
