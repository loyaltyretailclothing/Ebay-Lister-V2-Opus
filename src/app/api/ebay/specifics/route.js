import { ebayRequest } from "@/lib/ebay";
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

    // Use Taxonomy API (works with app token) instead of Sell Metadata API (needs user token)
    const data = await ebayRequest(
      `/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`
    );

    const specifics = (data.aspects || []).map((aspect) => ({
      name: aspect.localizedAspectName,
      localizedName: aspect.localizedAspectName,
      required: aspect.aspectConstraint?.aspectRequired || false,
      dataType: aspect.aspectConstraint?.aspectDataType || "STRING",
      mode: aspect.aspectConstraint?.aspectMode || "FREE_TEXT",
      values: (aspect.aspectValues || []).map((v) => v.localizedValue),
      maxValues: aspect.aspectConstraint?.aspectMaxValues || 1,
    }));

    return NextResponse.json({ success: true, specifics });
  } catch (error) {
    console.error("Item specifics error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
