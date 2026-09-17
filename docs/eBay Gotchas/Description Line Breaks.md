# Description Line Breaks

**Status: OPEN, diagnosed, not fixed.** See [[Open Issues]] #5.

## Symptom
Descriptions show on eBay as one big paragraph.

## How descriptions are built
- `buildDescription()` (`src/lib/descriptionTemplate.js`) joins lines with `\n`, using blank lines between sections: title, optional tag/measured sizes, condition text, "Ships USPS Ground Advantage!"
- The publish route converts every `\n` to `<br>` and sends the result as both `product.description` and `listingDescription`.

## Likely cause
Paragraph breaks become `<br><br>`, and eBay tends to collapse consecutive `<br>` tags.

## Options
- **A (recommended):** wrap each section in `<p>…</p>` instead of `<br><br>`.
- **B:** put `&nbsp;` between consecutive breaks.
- **C:** use HTML entities for newlines (unreliable).

To confirm first: inspect a live listing's description HTML to see whether the `<br>` tags survived.
