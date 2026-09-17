# Publishing to eBay

Route: `POST /api/ebay/list` (`src/app/api/ebay/list/route.js`). **No Claude calls, so publishing costs nothing in AI.** See [[Overview]].

## Steps
**A. SKU required.** Blank or missing SKU → stop: "SKU is required." SKUs are **never auto-generated** (removed 2026-09-16). The listing page also disables List on eBay until a SKU is entered.

**B. SKU safety check, before anything is sent to eBay** (`src/lib/skuGuard.js`). Looks up the SKU's offers and stops if the SKU was ever on a listing (live, sold, or ended), or if the lookup fails for any reason. See [[Orphan Offers and SKUs]].

0. **Upload photos to EPS** via the Media API, then use eBay's own `i.ebayimg.com` URLs. See [[Photo Hosting (EPS)]].
1. **PUT inventory item** (the SKU's product data, specifics, condition). ⚠️ This **replaces** whatever eBay holds under the SKU and eBay pushes it onto any listing using that SKU, which is why check B must come first.
2. **POST offer** (price, policies, Best Offer, category).
   - If eBay says the offer **already exists** (errorId 25002):
     - Any offer that was ever on a listing (has a listing id, or PUBLISHED) → stop. Never touched. (Backup net; check B normally stops this earlier.)
     - Offers that never became a listing (leftovers from a failed publish) → delete them and retry the create.
3. **POST publish.**
   - If publish **fails**, the just-created offer is deleted so the SKU isn't "burned." The error message says the orphan was cleaned up.
4. **Promote** (Marketing API), optional.
5. Logs `[POST] published listing <id>` for cost tracking. See [[Costs]].

## Error messages
`formatEbayErrors()` shows the full eBay error: `#errorId message (longMessage) [parameters]`. The `#number` and parameters usually point right at the field at fault.

## Conditions
Our condition keys map to eBay condition IDs in `src/lib/conditions.js`. See [[Conditions by Category]].

## Useful diagnostics
- `/api/ebay/sku-inspect?sku=XXXX` (read-only): shows the inventory item and all offers, including unpublished ones that don't appear in Seller Hub.

## Related gotchas
[[Orphan Offers and SKUs]] · [[Size Type and Size]] · [[Item Specifics Rejections]] · [[Description Line Breaks]]
