# Listed Report Plan

**Status: BUILT 2026-09-26, tested locally (nothing written), NOT live.** See [[Seasonal Hold Plan]], [[Home]], [[Sourcing]].

## The problem
Cost goes into Flipwise **after** an item is listed, and Flipwise needs the eBay listing to exist first. The users photograph the thrift tag to get the cost, then delete that photo before posting. That works when an item is listed the same day.

It breaks for **held** items: the item posts months later, the draft is deleted the moment it posts, and the tag photo is long gone. So the cost has to be captured as a **number** while the item is in hand, and survive the draft's deletion.

## What gets captured
In the **Hold until…** popup (held items only — items listed straight away don't need this):
- **Cost** — what was paid for the item.
- **Place of purchase** — the store, suggested from the [[Sourcing]] store list where possible.
- The red "Add price, SKU before holding" box is replaced by a small grey line, only shown when something's missing, so the space goes to these two fields.
- Saved on the draft, so the already-held items can be updated by reopening Hold on each.

## The permanent record
When **any** item posts (the 7am hold run or List on eBay by hand), one small record is written — separate from the draft, because the draft is deleted at posting:

`at · title · SKU · cost · place of purchase · eBay listing id + link · eBay image link`

- **The photo link is eBay's own image**, not Cloudinary: it keeps working as long as the listing exists and doesn't break when library photos are deleted.
- Stored like the other logs: one tiny raw file per item in Cloudinary (~0.5 KB, so ~2-3 MB/year at 400 listings/month — nothing against the free tier). Add-only; nothing overwrites anything.
- Items listed before this goes live have no record.

## The report — "Listed" page
Photo · Title · SKU · Place of purchase · Cost · Date · link to the listing.
- Date range (this week / last week / month / custom) — the Flipwise workflow is "pull this week's list and work down it".
- Total spend for the range.
- Cost and place are blank for items listed straight away (by design).

## Cost
$0 — no AI, no new accounts.

## How it's built
- **Hold popup** (`HoldDialog.js`): **Cost paid** and **Place of purchase** (store names suggested from [[Sourcing]]); the red missing-fields box is now a one-line grey note. Saved on the draft as `cost` / `purchasePlace` via `holdDraft`.
- **The record**: `src/lib/listedLog.js` writes one raw file per listing (`listed_<listingId>`, add-only, ~0.5 KB) including the eBay image URL — the publish route now returns `image` (the first EPS photo). Written from both paths: List on eBay by hand (`useListingEditor`) and the 7am hold run (`api/cron/post-held`, before the draft is deleted).
- **Report**: `/listed` (rail **Listed**) — photo, title, SKU, place, cost, date, eBay link; date range, search by title/SKU/place, and the spend total for the range.
- Held drafts from **before** this existed: reopen **Hold**, fill in cost and place, hold again.

## Verified locally 2026-09-26 (nothing written)
- Hold popup shows the two fields, no red box, store suggestions load from Sourcing; holding saved cost 6.99, purchasePlace "Goodwill Danforth Edmond", holdUntil 2027-03-01.
- Listed page with sample records: range filter, search, spend total ($24.48 for the week), "held" badge, eBay links; items listed straight away show a dash for cost and place, by design.
- Fixed while testing: duplicate store names caused a React key error; a draft held before the photo-marking existed showed an empty library panel (now falls back to the normal library).
