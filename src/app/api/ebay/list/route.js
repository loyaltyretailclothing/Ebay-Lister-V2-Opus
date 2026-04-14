import { getUserToken } from "@/lib/ebay";
import { EBAY_BASE_URL } from "@/lib/constants";
import { NextResponse } from "next/server";

// Map our condition values to eBay condition IDs
const CONDITION_MAP = {
  NEW_WITH_TAGS: { conditionId: "1000", conditionDescription: "" },
  NEW_WITHOUT_TAGS: { conditionId: "1500", conditionDescription: "" },
  NEW_WITH_DEFECTS: { conditionId: "1750", conditionDescription: "" },
  PRE_OWNED_EXCELLENT: { conditionId: "3000", conditionDescription: "" },
  PRE_OWNED_GOOD: { conditionId: "3000", conditionDescription: "" },
  PRE_OWNED_FAIR: { conditionId: "3000", conditionDescription: "" },
};

async function ebayFetch(path, options, token) {
  const res = await fetch(`${EBAY_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Content-Language": "en-US",
      ...options.headers,
    },
  });

  // Some eBay endpoints return 204 No Content on success
  if (res.status === 204) return { ok: true, status: 204, data: null };

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { rawResponse: text };
  }

  return { ok: res.ok, status: res.status, data };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      title,
      categoryId,
      condition,
      condition_description,
      item_description,
      price,
      quantity,
      bestOffer,
      minOffer,
      autoAcceptPrice,
      listingType,
      photos,
      itemSpecifics,
      sku,
      scheduledDate,
      scheduledTime,
      shippingPolicyId,
      paymentPolicyId,
      returnPolicyId,
      weightLbs,
      weightOz,
      dimLength,
      dimWidth,
      dimHeight,
      promotedListing,
      promoRate,
      priorityListing,
      priorityBudget,
    } = body;

    // Validation
    if (!title) return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    if (!categoryId) return NextResponse.json({ success: false, error: "Category is required" }, { status: 400 });
    if (!price) return NextResponse.json({ success: false, error: "Price is required" }, { status: 400 });
    if (!photos?.length) return NextResponse.json({ success: false, error: "At least one photo is required" }, { status: 400 });

    const token = await getUserToken();
    const itemSku = sku || `LISTING-${Date.now()}`;

    // --- Step 1: Create/Update Inventory Item ---
    const conditionInfo = CONDITION_MAP[condition] || CONDITION_MAP.PRE_OWNED_GOOD;

    // Build item specifics as name-value pairs
    const aspects = {};
    if (itemSpecifics) {
      for (const [key, val] of Object.entries(itemSpecifics)) {
        if (val === null || val === undefined || val === "") continue;
        // eBay expects arrays of strings
        aspects[key] = Array.isArray(val) ? val : [String(val)];
      }
    }

    // Build package weight
    const totalOz =
      (parseFloat(weightLbs) || 0) * 16 + (parseFloat(weightOz) || 0);

    const inventoryItem = {
      availability: {
        shipToLocationAvailability: {
          quantity: parseInt(quantity) || 1,
        },
      },
      condition: conditionInfo.conditionId,
      conditionDescription: condition_description || conditionInfo.conditionDescription,
      product: {
        title,
        description: item_description || "",
        aspects,
        imageUrls: photos.map((p) => p.secure_url),
      },
    };

    // Add package weight if provided
    if (totalOz > 0) {
      inventoryItem.packageWeightAndSize = {
        weight: {
          value: totalOz,
          unit: "OUNCE",
        },
      };

      // Add dimensions if provided
      if (dimLength && dimWidth && dimHeight) {
        inventoryItem.packageWeightAndSize.dimensions = {
          length: parseFloat(dimLength),
          width: parseFloat(dimWidth),
          height: parseFloat(dimHeight),
          unit: "INCH",
        };
      }
    }

    const inventoryRes = await ebayFetch(
      `/sell/inventory/v1/inventory_item/${encodeURIComponent(itemSku)}`,
      { method: "PUT", body: JSON.stringify(inventoryItem) },
      token
    );

    if (!inventoryRes.ok) {
      const errMsg = inventoryRes.data?.errors
        ? inventoryRes.data.errors.map((e) => e.message).join("; ")
        : JSON.stringify(inventoryRes.data);
      return NextResponse.json(
        { success: false, error: `Inventory item failed: ${errMsg}`, step: "inventory" },
        { status: 400 }
      );
    }

    // --- Step 2: Create Offer ---
    const offer = {
      sku: itemSku,
      marketplaceId: "EBAY_US",
      format: listingType || "FIXED_PRICE",
      categoryId,
      listingDescription: item_description || "",
      pricingSummary: {
        price: {
          value: parseFloat(price).toFixed(2),
          currency: "USD",
        },
      },
      listingPolicies: {},
    };

    // Add best offer settings
    if (bestOffer) {
      offer.pricingSummary.minimumAdvertisedPrice = undefined;
      offer.listingPolicies.bestOfferTerms = {
        bestOfferEnabled: true,
      };
      if (autoAcceptPrice) {
        offer.listingPolicies.bestOfferTerms.autoAcceptPrice = {
          value: parseFloat(autoAcceptPrice).toFixed(2),
          currency: "USD",
        };
      }
      if (minOffer) {
        offer.listingPolicies.bestOfferTerms.autoDeclinePrice = {
          value: parseFloat(minOffer).toFixed(2),
          currency: "USD",
        };
      }
    }

    // Add business policies
    if (shippingPolicyId) {
      offer.listingPolicies.fulfillmentPolicyId = shippingPolicyId;
    }
    if (paymentPolicyId) {
      offer.listingPolicies.paymentPolicyId = paymentPolicyId;
    }
    if (returnPolicyId) {
      offer.listingPolicies.returnPolicyId = returnPolicyId;
    }

    const offerRes = await ebayFetch(
      "/sell/inventory/v1/offer",
      { method: "POST", body: JSON.stringify(offer) },
      token
    );

    if (!offerRes.ok) {
      const errMsg = offerRes.data?.errors
        ? offerRes.data.errors.map((e) => e.message).join("; ")
        : JSON.stringify(offerRes.data);
      return NextResponse.json(
        { success: false, error: `Create offer failed: ${errMsg}`, step: "offer" },
        { status: 400 }
      );
    }

    const offerId = offerRes.data?.offerId;
    if (!offerId) {
      return NextResponse.json(
        { success: false, error: "No offer ID returned from eBay", step: "offer" },
        { status: 500 }
      );
    }

    // --- Step 3: Publish Offer ---
    const publishBody = {};

    // If scheduled, add the scheduled time
    if (scheduledDate) {
      const time = scheduledTime || "08:00";
      const scheduledDateTime = new Date(`${scheduledDate}T${time}:00`);
      publishBody.listingStartDate = scheduledDateTime.toISOString();
    }

    const publishRes = await ebayFetch(
      `/sell/inventory/v1/offer/${offerId}/publish`,
      { method: "POST", body: JSON.stringify(publishBody) },
      token
    );

    if (!publishRes.ok) {
      const errMsg = publishRes.data?.errors
        ? publishRes.data.errors.map((e) => e.message).join("; ")
        : JSON.stringify(publishRes.data);
      return NextResponse.json(
        { success: false, error: `Publish failed: ${errMsg}`, step: "publish" },
        { status: 400 }
      );
    }

    const listingId = publishRes.data?.listingId;

    // --- Step 4: Promote Listing (optional) ---
    let promoResult = null;
    if (promotedListing && listingId) {
      try {
        // Create a promoted listing standard campaign or add to existing
        const promoRes = await ebayFetch(
          "/sell/marketing/v1/ad_campaign/create_by_listing_id",
          {
            method: "POST",
            body: JSON.stringify({
              listingId,
              bidPercentage: String(promoRate || 5),
            }),
          },
          token
        );
        promoResult = promoRes.ok ? "promoted" : "promo_failed";
      } catch {
        promoResult = "promo_failed";
      }
    }

    return NextResponse.json({
      success: true,
      listingId,
      offerId,
      sku: itemSku,
      promoResult,
      url: `https://www.ebay.com/itm/${listingId}`,
    });
  } catch (error) {
    console.error("Listing submission error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
