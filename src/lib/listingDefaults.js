// The blank listing Create Listing starts from.
export const INITIAL_LISTING = {
  title: "",
  categoryId: "",
  categoryName: "",
  condition: "",
  condition_description: "",
  item_description: "",
  quantity: 1,
  bestOffer: true,
  autoAcceptPrice: "",
  promotedListing: true,
  promoRate: 5,
  weightLbs: "",
  weightOz: "",
  dimLength: "",
  dimWidth: "",
  dimHeight: "",
  shippingPolicyId: "",
  paymentPolicyId: "",
  returnPolicyId: "",
  itemSpecifics: {},
  sku: "",
  // Off by default — listings are rarely scheduled.
  scheduleEnabled: false,
  scheduledDate: "",
  scheduledTime: "17:00",
  // aiNote — read by Claude during analysis (a hint to help it get the item
  // right). draftNote — internal note for whoever finalizes the draft; the
  // AI never sees it and it never reaches eBay. Both ride on the listing so
  // they persist through draft save/load and survive re-analysis.
  aiNote: "",
  draftNote: "",
  // SEO title pieces + ranked keywords from analysis. The app assembles the
  // title from these; keyword chips move keywords between title and Theme.
  // Empty for listings made before this feature (chips just don't show).
  titleParts: null,
  keywords: [],
  // Bumped on every analysis so the category lookup re-runs.
  analysisRun: 0,
  // Skip Draft: Next draft passes over this draft. Saved on its own.
  skipDraft: false,
};

// New listing: clear everything the ITEM owns, keep the account-level
// choices (format, offers, promotion and its rate, the three policies) so
// they don't have to be re-picked on every listing.
export function blankListingKeepingDefaults(prev) {
  return {
    ...INITIAL_LISTING,
    listingType: prev?.listingType,
    bestOffer: prev?.bestOffer ?? INITIAL_LISTING.bestOffer,
    promotedListing: prev?.promotedListing ?? INITIAL_LISTING.promotedListing,
    promoRate: prev?.promoRate ?? INITIAL_LISTING.promoRate,
    shippingPolicyId: prev?.shippingPolicyId || "",
    paymentPolicyId: prev?.paymentPolicyId || "",
    returnPolicyId: prev?.returnPolicyId || "",
  };
}

// Title, category, price and SKU are required to list.
export function missingRequired(listing) {
  return (
    !listing?.title ||
    !listing?.categoryId ||
    !listing?.price ||
    !String(listing?.sku || "").trim()
  );
}

// The submit button's label: it says when a listing will be scheduled.
export function listButtonLabel(listing) {
  return listing?.scheduleEnabled && listing?.scheduledDate
    ? `Schedule Listing for ${listing.scheduledDate}`
    : "List on eBay";
}
