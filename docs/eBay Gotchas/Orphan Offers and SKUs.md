# Orphan Offers and SKUs

**Status: FIXED.** See [[Publishing to eBay]].

## What an orphan is
Publishing creates an **offer** first, then publishes it. If the publish step fails, the offer stays on eBay as **UNPUBLISHED**. It's invisible in Seller Hub, but it blocks that SKU: the next attempt gets errorId 25002 ("already exists").

## How it bit us
- A publish failed with "Best Offer Auto Accept Price entered has an invalid value" even though the box was empty. The old code silently **reused** an orphan offer that carried stale settings.
- Every failed publish "burned" a SKU (C3327, C3336).

## Fixes
1. **No silent reuse:** full eBay error details are shown instead.
2. **Clean up on failure:** if publish fails, the just-created offer is deleted.
3. **Auto-reclaim old orphans:** on 25002, look at existing offers for the SKU:
   - UNPUBLISHED → delete, then create again with current form settings
   - PUBLISHED (a live listing) → stop with a clear error, never touch it
4. **Diagnostic:** `/api/ebay/sku-inspect?sku=` (read-only).

## Lesson
An early guess blamed an eBay Best Offer rule that doesn't exist. Other listings with a minimum offer and no auto-accept publish fine. Verify before stating eBay rules ([[Rules]] #5).
