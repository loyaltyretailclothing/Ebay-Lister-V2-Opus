import { ebayRequest } from "@/lib/ebay";
import { NextResponse } from "next/server";

// Strict 1-to-1 mapping from our internal condition enum to eBay condition IDs.
// Mirrors CONDITION_MAP in /api/ebay/list so comps use the same IDs we list
// against. If the caller doesn't supply a condition (or sends an unknown
// value), fall back to the full set so the feature still works.
const COMPS_CONDITION_IDS = {
  NEW_WITH_TAGS: "1000",
  NEW_WITHOUT_TAGS: "1500",
  NEW_WITH_DEFECTS: "1750",
  PRE_OWNED_EXCELLENT: "2990",
  PRE_OWNED_GOOD: "3000",
  PRE_OWNED_FAIR: "3010",
};
const DEFAULT_CONDITION_IDS = "1000|1500|1750|2990|3000|3010";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const condition = searchParams.get("condition");

    if (!query) {
      return NextResponse.json(
        { success: false, error: "No search query provided" },
        { status: 400 }
      );
    }

    const conditionIds =
      COMPS_CONDITION_IDS[condition] || DEFAULT_CONDITION_IDS;

    // Search for comparable items — filtered to the same condition as the
    // listing being created so apples-to-apples pricing.
    const data = await ebayRequest(
      `/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&filter=buyingOptions:{FIXED_PRICE},conditionIds:{${conditionIds}},priceCurrency:USD&sort=-price&limit=10`,
      {
        headers: {
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        },
      }
    );

    const items = (data.itemSummaries || []).map((item) => ({
      title: item.title,
      price: item.price?.value ? parseFloat(item.price.value) : null,
      currency: item.price?.currency || "USD",
      condition: item.condition,
      imageUrl: item.image?.imageUrl || null,
      itemUrl: item.itemWebUrl,
      soldDate: item.itemEndDate || null,
    }));

    const prices = items.filter((i) => i.price).map((i) => i.price);
    const stats = prices.length
      ? {
          count: prices.length,
          average: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
          low: Math.min(...prices),
          high: Math.max(...prices),
        }
      : null;

    return NextResponse.json({ success: true, items, stats });
  } catch (error) {
    console.error("Sold comps error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
