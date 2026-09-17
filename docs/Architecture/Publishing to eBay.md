# Publishing to eBay

Route: `POST /api/ebay/list` (`src/app/api/ebay/list/route.js`). **No Claude calls, so publishing costs nothing in AI.** See [[Overview]].

## Steps
0. **Upload photos to EPS** via the Media API, then use eBay's own `i.ebayimg.com` URLs. See [[Photo Hosting (EPS)]].
1. **PUT inventory item** (the SKU's product data, specifics, condition).
2. **POST offer** (price, policies, Best Offer, category).
   - If eBay says the offer **already exists** (errorId 25002):
     - **PUBLISHED** offer (a live listing) → stop with a clear error. Never touched.
     - **UNPUBLISHED** offer (an orphan from an earlier failure) → delete it and retry the create.
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
