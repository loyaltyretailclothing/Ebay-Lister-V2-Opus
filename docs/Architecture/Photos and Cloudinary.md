# Photos and Cloudinary

See [[Overview]].

## What's stored where
| Data | Location |
|---|---|
| Photos | Images under `ebay-listings/…` (e.g. `unassigned`, `aaron`), shown as folders All Photos / Shannon / Aaron |
| Drafts | Raw JSON under `ebay-drafts/` |
| Item specifics settings | Raw JSON `ebay-listings/config/item-specifics` |
| Sourcing | Raw JSON `ebay-listings/config/sourcing` |

Photos are stored shrunk to fit inside 1600×1600, keeping their shape, at quality 80 (changed from 75 on 2026-09-18; older photos stay at 75). The phone compresses lightly first (camera and library both JPEG 90) so Cloudinary does the one real compression. Before 2026-09-18 a leftover setting forced every upload to exactly 1600×1600, which squashed non-square photos. Existing photos were all square, so nothing looked wrong.

AI analysis gets its own copy made on request: 600px, quality 70 (`c_limit,w_600,q_70`). It doesn't depend on the storage quality, so the AI cost is the same.

## ⚠️ Local dev and production use the same Cloudinary account
Testing locally reads and writes real data. See [[Rules]] #6–8.

## Library
- Uses Cloudinary Search with `next_cursor` paging. The **"Load older photos"** button fetches the next page (fixed an issue where anything past the first 500 was hidden).

## Account and limits (checked around 2026-08-30)
- Free plan. Credits about 67% used (16.7 / 25).
- **Two separate limits:**
  - **Credits:** storage, bandwidth, transformations. Not the problem.
  - **API requests per hour** (Admin + Search): easy to hit when both users work at once, because the Drafts page re-checks every 5 seconds and each library load is a search.
- Hitting the hourly limit shows **"Failed to load drafts / photos."** Data is not affected, and it recovers when the hour resets.
- Proposed fix: [[Open Issues]] #2.

## Photo cleanup
Photos can only be safely removed after an item sells and its photos are on eBay's hosting. See [[Photo Hosting (EPS)]].
