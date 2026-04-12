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

    // Search for sold/completed items
    const data = await ebayRequest(
      `/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&filter=buyingOptions:{FIXED_PRICE},conditionIds:{1000|1500|1750|2000|2500|3000},priceCurrency:USD&sort=-price&limit=10`,
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
