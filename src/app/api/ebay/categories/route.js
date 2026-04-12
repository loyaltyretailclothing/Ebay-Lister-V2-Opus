import { ebayRequest } from "@/lib/ebay";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        { success: false, error: "No search query provided" },
        { status: 400 }
      );
    }

    const data = await ebayRequest(
      `/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(query)}`
    );

    const categories = (data.categorySuggestions || []).map((s) => ({
      id: s.category.categoryId,
      name: s.category.categoryName,
      ancestors: s.categoryTreeNodeAncestors?.map((a) => a.categoryName) || [],
    }));

    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error("Category search error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
