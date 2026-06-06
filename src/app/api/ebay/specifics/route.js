import { NextResponse } from "next/server";
import {
  fetchCategorySpecifics,
  fetchCategoryConditions,
} from "@/lib/listingPipeline";

// GET /api/ebay/specifics?categoryId=...
//
// Returns both the item-specifics schema AND the allowed condition IDs for
// the category, fetched in parallel (no extra round-trip for the client).
// Sell Metadata → Taxonomy fallback logic lives in listingPipeline.js,
// reused by the camera flow. Conditions are best-effort: if that lookup
// fails it returns [] and the form falls back to showing all conditions.
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

    const [specifics, conditionIds] = await Promise.all([
      fetchCategorySpecifics(categoryId),
      fetchCategoryConditions(categoryId),
    ]);
    return NextResponse.json({ success: true, specifics, conditionIds });
  } catch (error) {
    console.error("Item specifics error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
