import { getUserToken, uploadPhotosToEps } from "@/lib/ebay";
import { EBAY_BASE_URL } from "@/lib/constants";
import { NextResponse } from "next/server";

// Map our condition values to eBay Inventory API fields
// condition = enum string (passes serialization)
// conditionId = clothing-specific numeric ID (overrides at publish time)
const CONDITION_MAP = {
  NEW_WITH_TAGS:       { condition: "NEW",              conditionId: "1000" },
  NEW_WITHOUT_TAGS:    { condition: "NEW_OTHER",        conditionId: "1500" },
  NEW_WITH_DEFECTS:    { condition: "NEW_WITH_DEFECTS", conditionId: "1750" },
  PRE_OWNED_EXCELLENT: { condition: "PRE_OWNED_EXCELLENT", conditionId: "2990" },
  PRE_OWNED_GOOD:      { condition: "USED_EXCELLENT",      conditionId: "3000" },
  PRE_OWNED_FAIR:      { condition: "PRE_OWNED_FAIR",      conditionId: "3010" },
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

// Format the full eBay error envelope into a single useful string instead
// of dropping errorId/longMessage/parameters on the floor. Captures every
// field eBay surfaces so future failures are debuggable from the response
// alone — no need to dig through Vercel logs.
function formatEbayErrors(data) {
  const errors = data?.errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return JSON.stringify(data).slice(0, 500);
  }
  return errors
    .map((e) => {
      const parts = [];
      if (e.errorId) parts.push(`#${e.errorId}`);
      if (e.message) parts.push(e.message);
      if (e.longMessage && e.longMessage !== e.message) {
        parts.push(`(${e.longMessage})`);
      }
      if (Array.isArray(e.parameters) && e.parameters.length > 0) {
        const paramStr = e.parameters
          .map((p) => `${p.name}=${p.value}`)
          .join(", ");
        parts.push(`[${paramStr}]`);
      }
      return parts.join(" ");
    })
    .join("; ");
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
    } = body;

    // Validation
    if (!title) return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    if (!categoryId) return NextResponse.json({ success: false, error: "Category is required" }, { status: 400 });
    if (!price) return NextResponse.json({ success: false, error: "Price is required" }, { status: 400 });
    if (!photos?.length) return NextResponse.json({ success: false, error: "At least one photo is required" }, { status: 400 });

    // Convert plain-text newlines to HTML <br> so eBay renders line breaks
    // (stored in state as \n for a clean textarea UX)
    const itemDescriptionHtml = (item_description || "").replace(/\n/g, "<br>");

    const token = await getUserToken();
    const itemSku = sku || `LISTING-${Date.now()}`;

    // --- Step 0: Upload photos to eBay's EPS via the Media API ---
    // Hand eBay back its own URLs in the Inventory API call so revisions
    // and re-ingestion don't depend on the Cloudinary source URLs staying
    // alive. Fails the whole publish cleanly if any photo upload fails
    // (rather than leaving a partially-uploaded state); user can retry.
    let epsImageUrls;
    try {
      epsImageUrls = await uploadPhotosToEps(photos.map((p) => p.secure_url));
    } catch (err) {
      console.error("EPS upload failed:", err);
      return NextResponse.json(
        {
          success: false,
          error: `Photo upload to eBay failed: ${err.message}`,
          step: "eps_upload",
        },
        { status: 400 }
      );
    }

    // --- Step 0: Ensure inventory location exists ---
    const locationKey = "warehouse-47904";
    // Try to delete any old bad location, then create fresh
    const locationCheck = await ebayFetch(
      `/sell/inventory/v1/location/${locationKey}`,
      { method: "GET" },
      token
    );

    // Only create when eBay explicitly says "not found" (404). On 401/500/etc
    // the GET is ambiguous — bailing out here beats blindly POSTing a fresh
    // location body that will fail with a confusing "already exists" error.
    if (locationCheck.status === 404) {
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
      const locationRes = await ebayFetch(
        `/sell/inventory/v1/location/${locationKey}`,
        { method: "POST", body: JSON.stringify(createBody) },
        token
      );
      if (!locationRes.ok) {
        console.error("Location create failed:", locationRes.status, locationRes.data);
      }
    } else if (!locationCheck.ok) {
      // Non-404 failure — log and push on; the POST steps below will surface
      // any real auth/config problem with a useful error message.
      console.error("Location check failed:", locationCheck.status, locationCheck.data);
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
        description: itemDescriptionHtml,
        aspects,
        // EPS URLs (i.ebayimg.com) from Step 0, not the original Cloudinary
        // URLs. eBay now owns/hosts these and they stay valid across
        // revisions for the life of the listing.
        imageUrls: epsImageUrls,
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
      return NextResponse.json(
        {
          success: false,
          error: `Inventory item failed: ${formatEbayErrors(inventoryRes.data)}`,
          step: "inventory",
        },
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
      listingDescription: itemDescriptionHtml,
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

    if (!offerRes.ok) {
      const alreadyExists = offerRes.data?.errors?.some(
        (e) => e.errorId === 25002 || e.message?.includes("already exists")
      );

      if (alreadyExists) {
        // Auto-reclaim flow. Look up every existing offer for this SKU
        // and split them by status:
        //   - PUBLISHED: a live listing exists for this SKU. We REFUSE
        //     to touch it (could clobber a real listing) and surface a
        //     clear error so the user picks a different SKU or ends the
        //     existing listing first.
        //   - UNPUBLISHED: orphan(s) from a previous failed publish.
        //     Safe to delete — they're invisible in the seller hub UI
        //     and aren't tied to any live data. We delete them, then
        //     retry the POST /offer call so the user's current form
        //     settings drive the new offer (not the stale orphan).
        let existingOffers = [];
        try {
          const existingRes = await ebayFetch(
            `/sell/inventory/v1/offer?sku=${encodeURIComponent(itemSku)}`,
            { method: "GET" },
            token
          );
          existingOffers = existingRes.data?.offers || [];
        } catch {
          // best-effort — fall through; we'll surface a generic error below
        }

        const publishedOffers = existingOffers.filter(
          (o) => o.status === "PUBLISHED"
        );
        if (publishedOffers.length > 0) {
          const summaries = publishedOffers.map((o) => {
            const listingId = o.listing?.listingId;
            return listingId ? `PUBLISHED (listing ${listingId})` : "PUBLISHED";
          });
          return NextResponse.json(
            {
              success: false,
              error: `SKU "${itemSku}" is in use by a live listing on your eBay account. Existing offer(s): ${summaries.join(", ")}. Choose a different SKU (or end the existing listing on eBay first) and try again.`,
              step: "offer",
            },
            { status: 400 }
          );
        }

        const unpublishedOffers = existingOffers.filter(
          (o) => o.status === "UNPUBLISHED" || !o.status
        );
        if (unpublishedOffers.length === 0) {
          // eBay said "already exists" but we couldn't see anything.
          // Rare — could be a race or an offer in a status we don't
          // handle. Surface a clear error so the user can investigate.
          return NextResponse.json(
            {
              success: false,
              error: `SKU "${itemSku}" is already in use but we couldn't enumerate existing offers. Use /api/ebay/sku-inspect?sku=${encodeURIComponent(itemSku)} to investigate, or use a different SKU.`,
              step: "offer",
            },
            { status: 400 }
          );
        }

        // Delete the orphan(s).
        const failedDeletes = [];
        for (const o of unpublishedOffers) {
          try {
            const deleteRes = await ebayFetch(
              `/sell/inventory/v1/offer/${o.offerId}`,
              { method: "DELETE" },
              token
            );
            if (!deleteRes.ok) {
              failedDeletes.push(o.offerId);
              console.error(
                `Orphan delete failed for ${o.offerId} (status ${deleteRes.status}):`,
                JSON.stringify(deleteRes.data, null, 2)
              );
            }
          } catch (e) {
            failedDeletes.push(o.offerId);
            console.error(`Orphan delete threw for ${o.offerId}:`, e);
          }
        }
        if (failedDeletes.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: `SKU "${itemSku}" had orphan offer(s) but cleanup failed for: ${failedDeletes.join(", ")}. Use a different SKU and try again, or investigate via /api/ebay/sku-inspect?sku=${encodeURIComponent(itemSku)}.`,
              step: "offer",
            },
            { status: 400 }
          );
        }

        // Retry POST /offer — orphan(s) are gone, this should now succeed
        // and we fall through to Step 3 publish naturally.
        offerRes = await ebayFetch(
          "/sell/inventory/v1/offer",
          { method: "POST", body: JSON.stringify(offer) },
          token
        );
        offerId = offerRes.data?.offerId;

        if (!offerRes.ok) {
          return NextResponse.json(
            {
              success: false,
              error: `Create offer failed after orphan cleanup: ${formatEbayErrors(offerRes.data)}`,
              step: "offer",
            },
            { status: 400 }
          );
        }
      } else {
        // Some other offer-creation failure (not an "already exists").
        return NextResponse.json(
          {
            success: false,
            error: `Create offer failed: ${formatEbayErrors(offerRes.data)}`,
            step: "offer",
          },
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
      console.error("eBay publish error:", JSON.stringify(publishRes.data, null, 2));

      // Clean up the offer we just created so this failed publish doesn't
      // leave an orphan UNPUBLISHED offer that "burns" the SKU. Without
      // this cleanup, the user can't retry with the same SKU even after
      // fixing the underlying issue — eBay's seller hub UI doesn't show
      // unpublished offers, so the SKU appears unused but POST /offer
      // would fail with "already exists" on the next attempt.
      //
      // Best-effort: if the cleanup itself fails, we log and surface a
      // hint, but we still return the ORIGINAL publish error (not the
      // cleanup error) so the user sees the actionable cause.
      let cleanupOk = false;
      try {
        const cleanupRes = await ebayFetch(
          `/sell/inventory/v1/offer/${offerId}`,
          { method: "DELETE" },
          token
        );
        cleanupOk = cleanupRes.ok;
        if (!cleanupOk) {
          console.error(
            `Orphan offer cleanup failed for ${offerId} (status ${cleanupRes.status}):`,
            JSON.stringify(cleanupRes.data, null, 2)
          );
        }
      } catch (cleanupErr) {
        console.error(
          `Orphan offer cleanup threw for ${offerId}:`,
          cleanupErr
        );
      }

      const cleanupNote = cleanupOk
        ? " The orphan offer was cleaned up — you can retry with the same SKU once the issue is fixed."
        : " (Cleanup of the orphan offer failed — you may need a new SKU on retry; use /api/ebay/sku-inspect to confirm.)";

      return NextResponse.json(
        {
          success: false,
          error: `Publish failed: ${formatEbayErrors(publishRes.data)}.${cleanupNote}`,
          step: "publish",
        },
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
