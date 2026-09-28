import { NextResponse } from "next/server";
import { fillItemSpecifics, newTally } from "@/lib/listingPipeline";
import { logAiCost } from "@/lib/costLog";

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

    const { observations, specifics, title, themeManaged, draftId, categoryName } =
      await request.json();

    if (!specifics?.length) {
      return NextResponse.json(
        { success: false, error: "No specifics provided" },
        { status: 400 }
      );
    }

    const tally = newTally();
    const filled = await fillItemSpecifics(observations, specifics, title, {
      themeManaged: !!themeManaged,
      tally,
    });
    await logAiCost(tally, { source: "specifics", draftId, category: categoryName });
    return NextResponse.json({ success: true, specifics: filled });
  } catch (error) {
    console.error("Pass 2 specifics error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
