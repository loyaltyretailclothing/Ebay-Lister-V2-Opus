// SKU safety check — decides whether a SKU may be used for a NEW listing.
//
// Runs BEFORE anything is sent to eBay. Writing an inventory item to a SKU
// replaces whatever eBay stores under it, and eBay pushes that change onto
// any live listing using the SKU — which overwrote live listings with a
// different item. So a SKU is only allowed if it has never been on a listing.
//
// Input: the raw result of GET /sell/inventory/v1/offer?sku=<sku>
//        as { ok, status, data } (see ebayFetch in /api/ebay/list).
//
// eBay responses (verified against live data):
//   - never used:   HTTP 404, errorId 25713 "This Offer is not available."
//   - live:         200, status PUBLISHED,   listing.listingStatus ACTIVE
//   - sold:         200, status UNPUBLISHED, listing.listingStatus OUT_OF_STOCK
//   - ended:        200, status UNPUBLISHED, listing.listingStatus ENDED
//   - failed-publish leftover: UNPUBLISHED with no listing id (never listed)
//
// Rules:
//   - allowed ONLY when eBay clearly says there are no offers (404 + 25713),
//     or the only offers are never-listed leftovers
//   - blocked when any offer has ever been on a listing (live/sold/ended) or
//     is PUBLISHED
//   - blocked on ANY other error or unexpected response (fail safe — a lookup
//     that failed must never be mistaken for "unused")

export const NO_OFFERS_ERROR_ID = 25713;

const LISTING_STATE_LABELS = {
  ACTIVE: "a live listing",
  OUT_OF_STOCK: "a listing that sold",
  ENDED: "a listing that ended",
};

// An offer that has ever been on an eBay listing (or is published).
export function offerWasListed(offer) {
  return !!(offer?.listing?.listingId || offer?.status === "PUBLISHED");
}

function describeOffer(offer) {
  const state = offer?.listing?.listingStatus;
  const label =
    LISTING_STATE_LABELS[state] ||
    (offer?.status === "PUBLISHED" ? "a live listing" : "a past listing");
  const id = offer?.listing?.listingId;
  return id ? `${label} (#${id})` : label;
}

export function evaluateSkuLookup(sku, lookup) {
  const errors = Array.isArray(lookup?.data?.errors) ? lookup.data.errors : [];

  // eBay's "no offers for this SKU" answer → never used.
  if (
    lookup?.status === 404 &&
    errors.some((e) => Number(e.errorId) === NO_OFFERS_ERROR_ID)
  ) {
    return { allowed: true, leftoverOffers: [] };
  }

  if (!lookup?.ok) {
    const detail = errors.length
      ? errors.map((e) => `#${e.errorId} ${e.message}`).join("; ")
      : `HTTP ${lookup?.status ?? "no response"}`;
    return {
      allowed: false,
      message: `Couldn't confirm SKU "${sku}" is unused (eBay lookup failed: ${detail}). Nothing was posted or changed — please try again.`,
    };
  }

  const offers = lookup.data?.offers;
  if (!Array.isArray(offers)) {
    return {
      allowed: false,
      message: `Couldn't confirm SKU "${sku}" is unused (unexpected response from eBay). Nothing was posted or changed — please try again.`,
    };
  }

  const listed = offers.filter(offerWasListed);
  if (listed.length > 0) {
    return {
      allowed: false,
      message: `SKU "${sku}" was already used on ${listed
        .map(describeOffer)
        .join(", ")}. Nothing was posted or changed. Use a SKU that has never been used.`,
    };
  }

  // Only never-listed leftovers from a failed publish — safe to reuse.
  return { allowed: true, leftoverOffers: offers };
}
