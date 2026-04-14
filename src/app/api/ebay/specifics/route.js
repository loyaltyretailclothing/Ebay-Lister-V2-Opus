import { ebayRequest, getUserToken } from "@/lib/ebay";
import { EBAY_BASE_URL } from "@/lib/constants";
import { NextResponse } from "next/server";

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

    let specifics;

    try {
      // Try Sell Metadata API first (user token — has accurate maxValues)
      const token = await getUserToken();
      const res = await fetch(
        `${EBAY_BASE_URL}/sell/metadata/v1/marketplace/EBAY_US/get_item_aspects_for_category?category_id=${categoryId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!res.ok) throw new Error("Sell Metadata API failed");

      const data = await res.json();
      specifics = (data.aspects || []).map((aspect) => ({
        name: aspect.localizedAspectName,
        localizedName: aspect.localizedAspectName,
        required: aspect.aspectConstraint?.aspectRequired || false,
        dataType: aspect.aspectConstraint?.aspectDataType || "STRING",
        mode: aspect.aspectConstraint?.aspectMode || "FREE_TEXT",
        values: (aspect.aspectValues || []).map((v) => v.localizedValue),
        maxValues: aspect.aspectConstraint?.aspectMaxValues || 1,
      }));
    } catch {
      // Fallback to Taxonomy API (app token)
      const data = await ebayRequest(
        `/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`
      );
      specifics = (data.aspects || []).map((aspect) => ({
        name: aspect.localizedAspectName,
        localizedName: aspect.localizedAspectName,
        required: aspect.aspectConstraint?.aspectRequired || false,
        dataType: aspect.aspectConstraint?.aspectDataType || "STRING",
        mode: aspect.aspectConstraint?.aspectMode || "FREE_TEXT",
        values: (aspect.aspectValues || []).map((v) => v.localizedValue),
        maxValues: aspect.aspectConstraint?.aspectMaxValues || 1,
      }));
    }

    return NextResponse.json({ success: true, specifics });
  } catch (error) {
    console.error("Item specifics error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
