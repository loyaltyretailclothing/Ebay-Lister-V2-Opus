import { getUserToken } from "@/lib/ebay";
import { EBAY_BASE_URL } from "@/lib/constants";
import { NextResponse } from "next/server";

// Map our condition values to eBay Inventory API fields
// condition = enum string (passes serialization)
// conditionId = clothing-specific numeric ID (overrides at publish time)
const CONDITION_MAP = {
  NEW_WITH_TAGS:       { condition: "NEW",              conditionId: "1000" },
  NEW_WITHOUT_TAGS:    { condition: "NEW_OTHER",        conditionId: "1500" },
  NEW_WITH_DEFECTS:    { condition: "NEW_WITH_DEFECTS", conditionId: "1750" },
  PRE_OWNED_EXCELLENT: { condition: "USED_EXCELLENT",   conditionId: "2990" },
  PRE_OWNED_GOOD:      { condition: "USED_EXCELLENT",   conditionId: "3000" },
  PRE_OWNED_FAIR:      { condition: "USED_EXCELLENT",   conditionId: "3010" },
};

async function ebayFetch(path, options, token) {
  const res = await fetch(`${EBAY_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Content-Language": "en-US",
      "Accept-Language": "en-US",
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
      scheduleEnabled,
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

    // --- Step 0: Ensure inventory location exists ---
    const locationKey = "warehouse-47904";
    // Try to delete any old bad location, then create fresh
    const locationCheck = await ebayFetch(
      `/sell/inventory/v1/location/${locationKey}`,
      { method: "GET" },
      token
    );

    if (!locationCheck.ok) {
      // Location doesn't exist — create it
      const createBody = {
        location: {
          address: {
            postalCode: "47904",
            country: "US",
            stateOrProvince: "IN",
            city: "Lafayette",
          },
        },
        merchantLocationStatus: "ENABLED",
        name: "Warehouse 47904",
        locationTypes: ["WAREHOUSE"],
      };
      console.log("Creating location:", JSON.stringify(createBody, null, 2));
      const locationRes = await ebayFetch(
        `/sell/inventory/v1/location/${locationKey}`,
        { method: "POST", body: JSON.stringify(createBody) },
        token
      );
      console.log("Location create response:", locationRes.status, JSON.stringify(locationRes.data, null, 2));
    } else {
      console.log("Location already exists:", JSON.stringify(locationCheck.data, null, 2));
    }

    // --- Step 1: Create/Update Inventory Item ---
    const ebayCondition = CONDITION_MAP[condition] || CONDITION_MAP.PRE_OWNED_GOOD;

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
      condition: ebayCondition.condition,
      conditionId: ebayCondition.conditionId,
      conditionDescription: condition_description || "",
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
      {
        method: "PUT",
        body: JSON.stringify(inventoryItem),
      },
      token
    );

    if (!inventoryRes.ok) {
      console.error("eBay inventory error:", JSON.stringify(inventoryRes.data, null, 2));
      console.error("Inventory payload sent:", JSON.stringify(inventoryItem, null, 2));
      const errors = inventoryRes.data?.errors || [];
      const errMsg = errors.length > 0
        ? errors.map((e) => `${e.message}${e.longMessage ? ` — ${e.longMessage}` : ""}${e.parameters ? ` (${JSON.stringify(e.parameters)})` : ""}`).join("; ")
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
      merchantLocationKey: locationKey,
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

    // Add scheduled start date to offer
    if (scheduleEnabled && scheduledDate) {
      const time = scheduledTime || "08:00";
      const scheduledDateTime = new Date(`${scheduledDate}T${time}:00`);
      offer.listingStartDate = scheduledDateTime.toISOString();
    }

    let offerRes = await ebayFetch(
      "/sell/inventory/v1/offer",
      { method: "POST", body: JSON.stringify(offer) },
      token
    );

    let offerId = offerRes.data?.offerId;

    // If offer already exists for this SKU, fetch the existing offer ID
    if (!offerRes.ok) {
      const alreadyExists = offerRes.data?.errors?.some(
        (e) => e.errorId === 25002 || e.message?.includes("already exists")
      );

      if (alreadyExists) {
        // Look up existing offers for this SKU — prefer one with a location
        const existingRes = await ebayFetch(
          `/sell/inventory/v1/offer?sku=${encodeURIComponent(itemSku)}`,
          { method: "GET" },
          token
        );
        const offers = existingRes.data?.offers || [];
        const withLocation = offers.find((o) => o.merchantLocationKey);
        offerId = withLocation?.offerId || offers[0]?.offerId;
      }

      if (!offerId) {
        const errMsg = offerRes.data?.errors
          ? offerRes.data.errors.map((e) => e.message).join("; ")
          : JSON.stringify(offerRes.data);
        return NextResponse.json(
          { success: false, error: `Create offer failed: ${errMsg}`, step: "offer" },
          { status: 400 }
        );
      }
    }

    // --- Step 3: Publish Offer ---
    const publishRes = await ebayFetch(
      `/sell/inventory/v1/offer/${offerId}/publish`,
      { method: "POST", body: JSON.stringify({}) },
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
        const adRate = (parseFloat(promoRate) || 5).toFixed(1);

        // 4a: Find an existing running Promoted Listings Standard campaign
        const campaignsRes = await ebayFetch(
          "/sell/marketing/v1/ad_campaign?campaign_status=RUNNING&limit=100",
          { method: "GET" },
          token
        );

        let campaignId = null;
        if (campaignsRes.ok && campaignsRes.data?.campaigns) {
          const standardCampaign = campaignsRes.data.campaigns.find(
            (c) => c.fundingStrategy?.fundingModel === "COST_PER_SALE"
          );
          if (standardCampaign) {
            campaignId = standardCampaign.campaignId;
          }
        }

        // 4b: If no campaign exists, create one
        if (!campaignId) {
          const createCampaignRes = await ebayFetch(
            "/sell/marketing/v1/ad_campaign",
            {
              method: "POST",
              body: JSON.stringify({
                marketplaceId: "EBAY_US",
                campaignName: `Promoted Listings Standard - ${new Date().toISOString().slice(0, 10)}`,
                fundingStrategy: {
                  fundingModel: "COST_PER_SALE",
                  bidPercentage: adRate,
                },
              }),
            },
            token
          );

          if (createCampaignRes.ok || createCampaignRes.status === 201) {
            // Campaign ID is in the Location header or response
            campaignId = createCampaignRes.data?.campaignId;
            // If not in body, parse from Location header URI
            if (!campaignId) {
              const locationUri = createCampaignRes.data?.location;
              if (locationUri) {
                campaignId = locationUri.split("/").pop();
              }
            }
          } else {
            console.error("Create campaign error:", JSON.stringify(createCampaignRes.data, null, 2));
          }
        }

        // 4c: Add the listing as an ad to the campaign
        if (campaignId) {
          const adRes = await ebayFetch(
            `/sell/marketing/v1/ad_campaign/${campaignId}/ad`,
            {
              method: "POST",
              body: JSON.stringify({
                listingId,
                bidPercentage: adRate,
              }),
            },
            token
          );

          if (adRes.ok || adRes.status === 201) {
            promoResult = "promoted";
          } else {
            // Ad might already exist (e.g. eBay auto-promoted it)
            const alreadyExists = adRes.data?.errors?.some(
              (e) => e.errorId === 35036 || e.message?.includes("already exists")
            );

            if (alreadyExists) {
              // Find the existing ad and update its bid percentage
              try {
                // Search all campaigns for this listing's ad
                const allCampaigns = campaignsRes.data?.campaigns || [];
                for (const camp of allCampaigns) {
                  if (camp.fundingStrategy?.fundingModel !== "COST_PER_SALE") continue;
                  const adsRes = await ebayFetch(
                    `/sell/marketing/v1/ad_campaign/${camp.campaignId}/ad?listing_ids=${listingId}`,
                    { method: "GET" },
                    token
                  );
                  const existingAd = adsRes.data?.ads?.[0];
                  if (existingAd) {
                    // Update the bid percentage
                    const updateRes = await ebayFetch(
                      `/sell/marketing/v1/ad_campaign/${camp.campaignId}/ad/${existingAd.adId}`,
                      {
                        method: "PUT",
                        body: JSON.stringify({ bidPercentage: adRate }),
                      },
                      token
                    );
                    promoResult = updateRes.ok || updateRes.status === 204 ? "promoted_updated" : "promo_update_failed";
                    break;
                  }
                }
                if (!promoResult) promoResult = "promoted_existing";
              } catch {
                // Ad exists but we couldn't update — still counts as promoted
                promoResult = "promoted_existing";
              }
            } else {
              const adErrMsg = adRes.data?.errors?.map(e => e.message).join("; ") || JSON.stringify(adRes.data);
              console.error("Create ad error:", JSON.stringify(adRes.data, null, 2));
              promoResult = `promo_failed: ${adErrMsg}`;
            }
          }
        } else {
          promoResult = "no_campaign";
        }
      } catch (promoError) {
        console.error("Promotion error:", promoError);
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
