import { NextResponse } from "next/server";
import { newTally, refineStyleName } from "@/lib/listingPipeline";
import { logAiCost } from "@/lib/costLog";

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

    const { listing, draftId } = await request.json();
    const tally = newTally();
    const merge = await refineStyleName(listing, tally);
    await logAiCost(tally, { source: "refine", draftId, category: listing?.categoryName });

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
