import { getUserToken } from "./ebay";
import { EBAY_BASE_URL } from "./constants";
import { matchPublished } from "./skuMatch";

// What eBay currently holds for a SKU: the inventory item and every offer,
// published or not. Read-only. Used by /api/ebay/sku-inspect for diagnosing
// "SKU already in use", and by the recovery below.

export async function inspectSku(sku) {
  const token = await getUserToken();
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  // Independent lookups — ask for both at once.
  const [inventoryRes, offerRes] = await Promise.all([
    fetch(`${EBAY_BASE_URL}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, { headers }),
    fetch(`${EBAY_BASE_URL}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`, { headers }),
  ]);

  // 404 on the inventory endpoint just means there is no inventory item —
  // not an error for an inspect call.
  let inventoryItem = null;
  if (inventoryRes.status === 200) {
    const data = await inventoryRes.json();
    inventoryItem = {
      sku: data.sku,
      condition: data.condition,
      quantity: data.availability?.shipToLocationAvailability?.quantity ?? null,
      title: data.product?.title,
      imageUrls: data.product?.imageUrls,
    };
  } else if (inventoryRes.status !== 404) {
    console.warn(
      `[sku-inspect] inventory_item lookup returned ${inventoryRes.status}: ${(await inventoryRes.text()).slice(0, 200)}`
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
      bestOfferEnabled: o.listingPolicies?.bestOfferTerms?.bestOfferEnabled ?? false,
      autoAcceptPrice: o.listingPolicies?.bestOfferTerms?.autoAcceptPrice?.value ?? null,
      autoDeclinePrice: o.listingPolicies?.bestOfferTerms?.autoDeclinePrice?.value ?? null,
    }));
  } else {
    console.warn(
      `[sku-inspect] offers lookup returned ${offerRes.status}: ${(await offerRes.text()).slice(0, 200)}`
    );
  }

  return { sku, inventoryItem, offers };
}

// --- Did it go live after all? --------------------------------------------
//
// eBay can list an item and the reply never reach us (the job cut short, the
// connection dropped). The listing is live but the app calls it a failure:
// the draft goes back in the queue, nothing reaches the Listed report, and
// the next attempt is refused for reusing the SKU. Asking eBay settles it.
//
// Only ever used when our own publish route gave NO answer. When it answers
// with a reason, that reason is the truth and this is never called.

export async function findPublishedListing(sku, title) {
  if (!String(sku || "").trim() || !String(title || "").trim()) return null;
  try {
    return matchPublished(await inspectSku(sku), title);
  } catch (err) {
    console.error("Couldn't check whether the listing went live:", err);
    return null; // no answer from eBay either — leave it as a failure
  }
}
