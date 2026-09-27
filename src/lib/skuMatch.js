// Did our own listing go live? — the pure half, with no eBay credentials
// behind it, so the browser can use it too (see src/lib/skuInspect.js for
// the lookup, and useListingEditor / the posting run for why).

const tidy = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

// The live listing for a SKU, from an sku-inspect answer — but only when
// the item eBay holds under that SKU is the one we were publishing (same
// title). Without that check, a SKU that was genuinely already in use would
// be mistaken for our own success.
export function matchPublished(inspect, title) {
  const stored = inspect?.inventoryItem?.title;
  if (!stored || !title || tidy(stored) !== tidy(title)) return null;
  const live = (inspect.offers || []).find((o) => o.listingId);
  if (!live) return null;
  return {
    listingId: live.listingId,
    url: `https://www.ebay.com/itm/${live.listingId}`,
    image: inspect.inventoryItem.imageUrls?.[0] || "",
  };
}
