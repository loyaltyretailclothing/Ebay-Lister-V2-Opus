# Open Issues

Unresolved items, most important first. Last updated 2026-09-16. See [[Home]].

## 0. Saved categories can be wiped (found 2026-09-18, fixed in the redesign build, NOT live yet)
- **Bug (live app too):** opening a draft auto-adds its category to Settings. If that happened before Settings had loaded, the app saved a category list containing ONLY that one category, wiping the others and their multi-value ticks. Likely why Settings only ever had one saved category.
- **Happened during redesign testing on 2026-09-18:** the saved "Sweaters" category (and its ticks) was replaced by "T-Shirts". No Cloudinary backup exists. Sweaters will be re-added automatically the next time a sweater draft opens; its multi-value ticks need re-doing in Settings.
- **Fix (in the redesign build):** the server now changes one category at a time (add / set / remove) and rejects whole-list saves; the form waits for Settings before deciding.

## 1. Pants fail to publish: Size Type (waiting on a decision)
eBay error #25129: "Regular is not a valid Size Type for the Size 33" (also 37).
- **Cause:** for Men's Jeans (category 11483), eBay's API now allows only "Big & Tall" for waist sizes 33, 35 and 37. Our AI always picks "Regular." Details in [[Size Type and Size]].
- **Workaround today:** set Size Type to "Big & Tall" on the draft and publish again (same SKU works).
- **Decision needed:**
  1. Auto-pick the Size Type eBay allows. Always publishes, but 33/35/37 show as "Big & Tall."
  2. Investigate keeping "Regular": test leaving Size Type out, or sending eBay's combined "Regular - 33" value.


## 2. "Failed to load drafts / photos" when both users are working
- **Data was never at risk** (verified: 79 drafts and 1,533 photos intact).
- **Likely cause:** Cloudinary free-plan limit on API requests per hour. The Drafts page re-checks every 5 seconds while anything is processing, and two people doubles it.
- **Proposed fix (not built):** slow polling to 15–20s, pause it when the tab is hidden, retry a failed load once, and briefly cache lists. See [[Photos and Cloudinary]].
- **Redesign (built 2026-09-18, not live yet):** the 5-second polling is gone everywhere; drafts refresh only on open, save, publish, Next draft and Refresh.

## 3. Existing duplicate drafts
New duplicates are fixed (see [[Drafts and Camera Flow]]), but older duplicate pairs remain (Polo Ralph Lauren Cargo, Under Armour Showdown, Nike Golf Tour, possibly more). Offered: a read-only scan listing the pairs so they can delete the extras.

## 4. No backup for Sourcing data
Stores and trips live in one Cloudinary file with no undo. Proposed: keep the last ~10 versions on every save. See [[Sourcing]].

## 5. Descriptions show as one paragraph on eBay
Diagnosed, not fixed. See [[Description Line Breaks]].

## 6. Pass 2 cost: value lists
Pass 2 sends up to 200 allowed values per item specific. Cutting to ~50 could save money, but eBay doesn't guarantee value order, so the correct brand could be cut. Plan: measure which specifics are large before trimming. See [[Costs]].

## Smaller / later
- Resilience for Claude "overloaded" (529) errors during analysis.
- EPS audit / re-upload tool (Phase 2 of [[Photo Hosting (EPS)]]).
- Full UI design pass once features are done.
- **Dark mode toggle** (later): the new desktop Create Listing follows the device's light/dark setting for now. Add the nav-rail toggle (remembers the user's choice) later.
- **Laptop widths** (later): the new desktop Create Listing is for big windows only; smaller windows keep the old layout. Tune it for laptops later if needed.
