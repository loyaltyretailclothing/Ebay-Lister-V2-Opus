import { NextResponse } from "next/server";
import { fetchCategorySpecifics } from "@/lib/listingPipeline";

// GET /api/ebay/specifics?categoryId=...
//
// Thin wrapper — Sell Metadata → Taxonomy fallback logic lives in
// listingPipeline.js's fetchCategorySpecifics, reused by the camera flow.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: "No categoryId provided" },
        { status: 400 }
      );
    }

    const specifics = await fetchCategorySpecifics(categoryId);
    return NextResponse.json({ success: true, specifics });
  } catch (error) {
    console.error("Item specifics error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
