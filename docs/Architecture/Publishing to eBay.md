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

## If the answer is lost (2026-09-27)
eBay can list an item and the reply never reach us — the job cut short, the connection dropped. The listing is live, but the app used to call it a failure: the draft went back in the queue, nothing reached the [[Listed Report Plan|Listed report]], and the next attempt was refused for reusing the SKU (the guard doing its job, but it reads like a bug).

Now, **when our own route gives no reason**, both the hold run and List on eBay ask eBay whether it went up: `GET /api/ebay/sku-inspect?sku=` (read-only). If it did, the item is finished properly — Listed record, draft cleared, photos scheduled, Efficiency entry — and said out loud:
- **By hand:** "Listed on eBay! Item 336… · The reply from eBay was lost, but the listing is live — promotion not confirmed."
- **The hold run:** counted as posted, and named on the On Hold page banner under "Worth a look".

**It only asks when it doesn't know.** A reason from our route ("SKU already used", "Create offer failed") is definitive — those paths clean up after themselves — so nothing changes there, and no extra call is made. Normal listings are untouched.

**It can't claim someone else's listing.** A match needs a live listing id *and* the item eBay stores under that SKU to have the same title we were publishing (`src/lib/skuMatch.js`, `matchPublished`). A SKU that was genuinely already in use has a different title, so it is refused.

Verified locally 2026-09-27, nothing written: 14 matcher checks (including a different live item under the same SKU → refused); in the browser, a platform timeout with nothing live → still a failure; the same timeout with a matching live listing → listed, draft cleared, moved on; a real error from our route → no lookup at all.

## Time limit
The route asks for **60 seconds** (`maxDuration`), like the posting run. It had none until 2026-09-27, so it took the platform's short default (~10-15 s) while uploading every photo to eBay and making four more calls — see [[Seasonal Hold Plan]], the failed posting morning.

## Scheduled listings — the time means Central (fixed 2026-09-27)
`scheduledDate` + `scheduledTime` are read as the users' own time (`America/Chicago`, `src/lib/localTime.js`) and converted to UTC for `offer.listingStartDate`. Before this they were read off the **server** clock, which is UTC on Vercel, so a listing set for **5pm went live at noon** Central — and the error changed by an hour with daylight saving. Verified: 5pm on Sep 28 → `22:00Z`, 5pm on Dec 15 → `23:00Z`. An unreadable date or time is now left off the offer rather than sent wrong.

## Error messages
`formatEbayErrors()` shows the full eBay error: `#errorId message (longMessage) [parameters]`. The `#number` and parameters usually point right at the field at fault.

## Conditions
Our condition keys map to eBay condition IDs in `src/lib/conditions.js`. See [[Conditions by Category]].

## Where listings say they ship from (fixed 2026-09-27)
The **"Item location"** buyers see, and the origin zip for calculated shipping, come from the **inventory location** the offer names (`merchantLocationKey`) — **not** from the shipping business policy. A policy cannot set item location, which is why changing the policy never moved it.

The app named `warehouse-47904` (Lafayette, Indiana), so every listing went out saying Indiana. It now names **`US_74074`** — the account's own Stillwater, Oklahoma location, which eBay created from the seller shipping settings. No new location was made and nothing was written to eBay.

The account holds four locations (`US_47904`, `US_74074`, `default-location`, `warehouse-47904`); the unused ones are harmless. The create-if-missing branch in the route now carries the Stillwater address too, for a fresh account.

**Listings posted before this keep saying Lafayette** — the location is fixed on each offer at posting time. Correcting the back catalogue would mean revising every live offer, a separate job.

## Useful diagnostics
- `/api/ebay/sku-inspect?sku=XXXX` (read-only): shows the inventory item and all offers, including unpublished ones that don't appear in Seller Hub.
- `/api/ebay/locations` (read-only): every inventory location and the address it holds — what buyers are actually shown.

## Related gotchas
[[Orphan Offers and SKUs]] · [[Size Type and Size]] · [[Item Specifics Rejections]] · [[Description Line Breaks]]
