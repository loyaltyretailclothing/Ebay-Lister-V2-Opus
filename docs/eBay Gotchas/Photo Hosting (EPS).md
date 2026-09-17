# Photo Hosting (EPS)

**Status: working.** See [[Publishing to eBay]], [[Photos and Cloudinary]].

## Why
Listings used to reference Cloudinary URLs. If those photos were later deleted from Cloudinary, revising the listing could break. Uploading to eBay's own hosting (EPS) gives eBay-owned `i.ebayimg.com` URLs.

## How
- `uploadPhotosToEps()` in `src/lib/ebay.js`: Media API `create_image_from_url` (host `apim.ebay.com`, `sell.inventory` scope) → image id from the Location header → get image → EPS URL.
- Runs as step 0 of publishing. The Inventory API then receives EPS URLs.
- Existing drafts work unchanged (they still hold Cloudinary URLs until publish).

## Facts
- Unused EPS images are purged by eBay after about 30 days.
- Trading API `UploadSiteHostedPictures` is being decommissioned Sept 30, 2026. The Media API is the replacement.
- Media API limit: about 50 POSTs per 5 seconds.

## Known error
- **190204** "No valid image can be downloaded from the provided imageUrl": happened once, worked on retry (transient). A fallback to Cloudinary URLs was offered but not built, since EPS was working.

## Later
An audit / re-upload tool (Phase 2) was discussed, not built.
