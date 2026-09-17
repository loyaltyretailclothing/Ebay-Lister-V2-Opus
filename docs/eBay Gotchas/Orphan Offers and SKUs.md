# Orphan Offers and SKUs

**Status: FIXED** (duplicate-SKU overwrite fixed 2026-09-16). See [[Publishing to eBay]].

## 🚨 Duplicate SKU overwrote live listings (fixed 2026-09-16)
- **Symptom:** posting a new item with a SKU that was already on a live eBay listing replaced that live listing with the new item. The old item was no longer listed, so it had to be reshot.
- **Cause:** publishing saves the item to the SKU (PUT inventory item) **before** checking the SKU. That save replaces whatever eBay holds under the SKU, and eBay automatically pushes the change onto any live listing using it. The "already in use" check only ran afterwards, at offer creation.
- **Also found:** the auto-cleanup deleted any **UNPUBLISHED** offer, but eBay marks **sold and ended** listings as UNPUBLISHED too, so a sold or ended listing's record could be deleted and its SKU taken over.

### Fix
1. **SKU required.** Blank SKU → stop. Auto-generated SKUs removed. The listing page shows SKU as required and disables List on eBay until it's filled.
2. **SKU safety check before anything is sent** (`src/lib/skuGuard.js`, called first in `/api/ebay/list`). Blocks any SKU that was ever on a listing: **live, sold, or ended**. Users chose to block sold/ended too, so every SKU is used only once.
3. **Fail safe:** if the lookup errors, is rate-limited, or returns anything unexpected → stop, nothing posted.
4. **Cleanup only touches never-listed leftovers:** an offer with a listing id is never deleted, whatever its status.
5. **Retry still works:** a SKU whose only record is a leftover from a failed publish (never listed) is still allowed.

### What eBay returns (verified against live data)
| SKU state | GET `/offer?sku=` response | Decision |
|---|---|---|
| Never used | HTTP 404, errorId **25713** "This Offer is not available." | Allowed |
| Live | 200, `PUBLISHED`, listingStatus `ACTIVE` | Blocked |
| Sold | 200, `UNPUBLISHED`, listingStatus `OUT_OF_STOCK`, has listing id | Blocked |
| Ended | 200, `UNPUBLISHED`, listingStatus `ENDED`, has listing id | Blocked |
| Failed-publish leftover | `UNPUBLISHED`, no listing id | Allowed |
| Any other error / unexpected | — | Blocked |

### Limitation
The check sees listings created **through this app** (Inventory API; 1,247 SKUs as of 2026-09-16). Listings made directly on eBay's website or Seller Hub aren't visible to it. Adding that would need a different eBay lookup.

### Lesson
While surveying SKUs, one lookup failed and was misread as "no listing" (C4358 is actually live). A failed lookup must **never** be treated as "unused." That's why the check fails safe.

### Verified 2026-09-16 (nothing listed or changed)
- 12 logic tests with real response shapes, including fail-safe cases.
- Real read-only lookups: never-used allowed; live C4428, sold C4423, ended C4264, live C4358 blocked.
- Local publish route with a fake photo link (so nothing could be saved even if the check failed): blank, spaces-only and missing SKU stopped; live, sold and ended SKUs stopped at the SKU check; a never-used SKU passed the check and stopped at the fake photo.
- Listing page: SKU marked required, red when empty, List on eBay disabled.

## Earlier: orphan offers (fixed 2026-05-28)
Publishing creates an **offer** first, then publishes it. If the publish step fails, the offer stays on eBay as UNPUBLISHED with no listing. It's invisible in Seller Hub and blocks the SKU (errorId 25002 "already exists").
- A publish failed with "Best Offer Auto Accept Price entered has an invalid value" even though the box was empty. The old code silently **reused** an orphan offer with stale settings.
- Failed publishes "burned" SKUs (C3327, C3336).
- **Fixes:** show full eBay errors instead of reusing; delete the just-created offer when publish fails; clean up never-listed leftovers on retry. Diagnostic: `/api/ebay/sku-inspect?sku=` (read-only).
- **Lesson:** an early guess blamed an eBay Best Offer rule that doesn't exist. Verify before stating eBay rules ([[Rules]] #5).
