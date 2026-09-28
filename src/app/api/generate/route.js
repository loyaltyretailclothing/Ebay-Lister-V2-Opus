import { NextResponse } from "next/server";
import { analyzeListing, newTally } from "@/lib/listingPipeline";
import { logAiCost } from "@/lib/costLog";

// POST /api/generate
//
// Thin wrapper — the prompt + parsing + photo transform all live in
// listingPipeline.js so the manual flow and the camera flow (/api/drafts/
// process) stay word-for-word in sync. Any rule change happens in one place.
export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const { photos, notes, draftId } = await request.json();

    if (!photos?.length) {
      return NextResponse.json(
        { success: false, error: "No photos provided" },
        { status: 400 }
      );
    }

    const tally = newTally();
    const listing = await analyzeListing(photos, notes, tally);
    await logAiCost(tally, { source: "analyze", draftId, category: listing?.categoryName });
    return NextResponse.json({ success: true, listing });
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
