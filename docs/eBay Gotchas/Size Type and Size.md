# Size Type and Size

**Status: OPEN, waiting on a decision.** See [[Open Issues]] #1, [[Publishing to eBay]].

## Symptom
Error #25129: "The Size Type you selected is not compatible with the Size you entered … Regular is not a valid Size Type for the Size 33." Also seen for 37. It started suddenly; many size-33 jeans had published fine before.

## What eBay's API requires (Men's Jeans, category 11483, checked Aug–Sep 2026)
`Size Type` is required and selection-only: **Regular** or **Big & Tall**. Each `Size` value only allows certain Size Types:

| Waist | Allowed Size Type |
|---|---|
| 28, 29, 30, 31 | Regular |
| 32, 34, 36, 38, 40 | Regular or Big & Tall |
| **33, 35, 37** | **Big & Tall only** |

There's also a separate optional `Waist Size` aspect ("33 in").

## Why it happens
- Our app sends `Size Type` and `Size` as two separate fields, filled independently by the AI, which picks "Regular" for a normal jean.
- We don't keep eBay's value dependencies (only plain value lists), so nothing stops an invalid pair.
- **eBay's website disagrees with its own API:** when you duplicate a listing in eBay's UI, size is one combined picker ("Regular - 33") and 33 as Regular is accepted. The API we publish through rejects that pairing. The error text ("no longer support…") suggests eBay changed this recently.

## Workaround
On the draft, set Size Type to **Big & Tall** and publish again (same SKU works).

## Options on the table
1. **Auto-pick a compatible Size Type** using eBay's dependency data. Reliable, but 33/35/37 get labeled "Big & Tall" on eBay (could hurt "Regular" filter visibility).
2. **Investigate keeping "Regular":** test leaving out Size Type, or sending the combined "Regular - 33" style value the website uses.

## Lesson
An earlier explanation said "odd sizes need Big & Tall." That was an oversimplification; 29 and 31 are Regular. Always check the live data before stating eBay rules ([[Rules]] #5).
