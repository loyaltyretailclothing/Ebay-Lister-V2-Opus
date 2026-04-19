import { NextResponse } from "next/server";
import { fillItemSpecifics } from "@/lib/listingPipeline";

// POST /api/generate/specifics
//
// Thin wrapper — prompt + parsing logic lives in listingPipeline.js so the
// manual flow and camera flow stay in sync.
export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const { observations, specifics, title } = await request.json();

    if (!specifics?.length) {
      return NextResponse.json(
        { success: false, error: "No specifics provided" },
        { status: 400 }
      );
    }

    const filled = await fillItemSpecifics(observations, specifics, title);
    return NextResponse.json({ success: true, specifics: filled });
  } catch (error) {
    console.error("Pass 2 specifics error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
