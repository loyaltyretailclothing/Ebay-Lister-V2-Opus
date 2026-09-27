import { inspectSku } from "@/lib/skuInspect";
import { NextResponse } from "next/server";

// GET /api/ebay/sku-inspect?sku=XXXX
//
// Returns whatever eBay currently has stored for a given SKU — the
// inventory item (if any), and ALL offers (published and unpublished).
// Unpublished offers don't appear in the eBay seller hub UI, so this is
// the only practical way to see orphan offers left behind by a failed
// publish attempt. Used to diagnose "SKU already in use" surprises, and by
// Create Listing to ask whether a listing went live after a silent failure.
//
// Response shape:
//   {
//     success: true,
//     sku: "...",
//     inventoryItem: { sku, condition, quantity, title, imageUrls } | null,
//     offers: [
//       {
//         offerId, status, price, listingId, merchantLocationKey,
//         categoryId, bestOfferEnabled, autoAcceptPrice, autoDeclinePrice
//       }
//     ]
//   }
export async function GET(request) {
  try {
    const sku = new URL(request.url).searchParams.get("sku");
    if (!sku) {
      return NextResponse.json(
        { success: false, error: "Missing required ?sku= query parameter" },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, ...(await inspectSku(sku)) });
  } catch (error) {
    console.error("[sku-inspect] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
