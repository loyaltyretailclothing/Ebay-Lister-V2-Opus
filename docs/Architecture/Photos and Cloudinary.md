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

## Photos belonging to drafts (2026-09-25)
Each photo can carry a `heldDraft` context value — the id of the held draft it belongs to. While set, the photo is **hidden from the Photo Library** (desktop panel and phone page); opening that held draft shows only its photos. Cleared when the item posts, is unheld, or the draft is deleted. Set/cleared in `src/lib/drafts.js` (`markPhotosHeld`, `draftPhotoIds`) from the draft save, the hold PATCH, and `deleteDraft`.

**Finding them (fixed 2026-09-27):** the library loads only the newest 500 photos, so a held draft's older photos could never be found by filtering that page. `GET /api/cloudinary/list?heldFor=<draftId>` asks Cloudinary directly (`context.heldDraft="<id>"`), so age doesn't matter. `usePhotoLibrary` also numbers its requests — the big library fetch starts first but finishes last, and without that it overwrote the held-draft answer.

**When a held item posts (2026-09-27)** its photos are **deleted half an hour later**, not returned to the library: eBay has its own copies by then. Posting writes a small record (`ebay-listings/logs/photo-sweep/sweep_<draftId>`) with the due time and the photo ids; `POST /api/cloudinary/sweep` deletes what's due. It's called by any open tab (which sets a timer for the exact minute), by hand-listing, and by the daily cron. Nothing outside `ebay-listings/` can be scheduled or deleted. See `src/lib/photoSweep.js` and [[Seasonal Hold Plan]].

**Deleting a draft** (`DELETE /api/drafts/[id]?photos=1`) can delete its photos too — the checkbox in the confirm dialog. Without the flag the photos are released back into the library. See [[Seasonal Hold Plan]].
