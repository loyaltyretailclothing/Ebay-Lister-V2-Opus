# Item Specifics Rejections

See [[AI Pipeline]], [[Publishing to eBay]].

## Fabric Weight
- **Error:** #25002 "Fabric weight must be greater than 0. Use up to 1 decimal digit." (value 16, on a Super 120s wool item)
- **Cause:** Pass 2 invented a numeric Fabric Weight it couldn't actually see.
- **Workaround used:** clear the field and publish.
- **Not fixed in code.** Possible fixes if it recurs: tell Pass 2 not to invent measurements it can't see, or check numeric specifics before publishing.

## Size Type
See [[Size Type and Size]].

## General pattern
eBay adds and tightens per-category rules over time. When a listing that "always worked" suddenly fails, check the category's live aspects (`get_item_aspects_for_category`, including value constraints) before changing code.
