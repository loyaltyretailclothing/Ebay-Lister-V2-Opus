import { getUserToken } from "@/lib/ebay";
import { EBAY_BASE_URL } from "@/lib/constants";
import { NextResponse } from "next/server";

// GET /api/ebay/sku-inspect?sku=XXXX
//
// Returns whatever eBay currently has stored for a given SKU — the
// inventory item (if any), and ALL offers (published and unpublished).
// Unpublished offers don't appear in the eBay seller hub UI, so this is
// the only practical way to see orphan offers left behind by a failed
// publish attempt. Used to diagnose "SKU already in use" surprises.
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
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get("sku");

    if (!sku) {
      return NextResponse.json(
        { success: false, error: "Missing required ?sku= query parameter" },
        { status: 400 }
      );
    }

    const token = await getUserToken();

    // Parallel fetch — inventory item and offers are independent lookups.
    const [inventoryRes, offerRes] = await Promise.all([
      fetch(
        `${EBAY_BASE_URL}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      ),
      fetch(
        `${EBAY_BASE_URL}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      ),
    ]);

    // 404 on the inventory endpoint just means "no inventory item exists"
    // — not an error condition for an inspect call.
    let inventoryItem = null;
    if (inventoryRes.status === 200) {
      const data = await inventoryRes.json();
      inventoryItem = {
        sku: data.sku,
        condition: data.condition,
        quantity:
          data.availability?.shipToLocationAvailability?.quantity ?? null,
        title: data.product?.title,
        imageUrls: data.product?.imageUrls,
      };
    } else if (inventoryRes.status !== 404) {
      const errText = await inventoryRes.text();
      console.warn(
        `[sku-inspect] inventory_item lookup returned ${inventoryRes.status}: ${errText.slice(0, 200)}`
      );
    }

    let offers = [];
    if (offerRes.ok) {
      const data = await offerRes.json();
      offers = (data.offers || []).map((o) => ({
        offerId: o.offerId,
        status: o.status,
        price: o.pricingSummary?.price?.value,
        currency: o.pricingSummary?.price?.currency,
        listingId: o.listing?.listingId || null,
        merchantLocationKey: o.merchantLocationKey,
        categoryId: o.categoryId,
        format: o.format,
        bestOfferEnabled:
          o.listingPolicies?.bestOfferTerms?.bestOfferEnabled ?? false,
        autoAcceptPrice:
          o.listingPolicies?.bestOfferTerms?.autoAcceptPrice?.value ?? null,
        autoDeclinePrice:
          o.listingPolicies?.bestOfferTerms?.autoDeclinePrice?.value ?? null,
      }));
    } else {
      const errText = await offerRes.text();
      console.warn(
        `[sku-inspect] offers lookup returned ${offerRes.status}: ${errText.slice(0, 200)}`
      );
    }

    return NextResponse.json({
      success: true,
      sku,
      inventoryItem,
      offers,
    });
  } catch (error) {
    console.error("[sku-inspect] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
