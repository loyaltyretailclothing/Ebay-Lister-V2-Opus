# Item Specifics Rejections

See [[AI Pipeline]], [[Publishing to eBay]].

## Fabric Weight
- **Error:** #25002 "Fabric weight must be greater than 0. Use up to 1 decimal digit." (value 16, on a Super 120s wool item)
- **Cause:** Pass 2 invented a numeric Fabric Weight it couldn't actually see.
- **Workaround used:** clear the field and publish.
- **Not fixed in code.** Possible fixes if it recurs: tell Pass 2 not to invent measurements it can't see, or check numeric specifics before publishing.

## Two values in a one-value specific (e.g. Closure) — FIXED 2026-09-21
- **Error:** eBay rejects the listing when a specific that takes one value gets two (reported: Closure = "Button + Zip").
- **Cause:** `mapAspects` read `aspectConstraint.aspectMaxValues`, which **does not exist** in eBay's API (checked against the live Taxonomy spec) — so the app never knew which specifics take one value, never used it anyway, and Pass 2's prompt actively encouraged arrays. The real field is `aspectConstraint.itemToAspectCardinality` (`SINGLE` / `MULTI`).
- **It's per category, so the AI can't guess:** Closure is one-value in Casual Button-Down Shirts, Polos and Shorts, but multi in Jeans and Sweaters. Same for Pocket Type (single in Shorts, multi in Jeans) and Season (single in Polos, multi elsewhere).
- **Fix:** keep the real flag as `multi` on each aspect, and send it to Pass 2 (`"multi": true/false`) with an explicit rule — one value only when false, never an array and never "Button/Zip".
- **Not done (users' call, revisit if it recurs):** a safety net at publish time that trims a one-value specific to its first value.
- Across 87 drafts at the time: Theme 65, Features 58, Season 15, Accents 5, Occasion 4, **Closure 2**, Pocket Type 1 had 2+ values — most of those are legitimately multi.

## Size Type
See [[Size Type and Size]].

## General pattern
eBay adds and tightens per-category rules over time. When a listing that "always worked" suddenly fails, check the category's live aspects (`get_item_aspects_for_category`, including value constraints) before changing code.
