import { NextResponse } from "next/server";
import { analyzeListing } from "@/lib/listingPipeline";

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

    const { photos, notes } = await request.json();

    if (!photos?.length) {
      return NextResponse.json(
        { success: false, error: "No photos provided" },
        { status: 400 }
      );
    }

    const listing = await analyzeListing(photos, notes);
    return NextResponse.json({ success: true, listing });
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
