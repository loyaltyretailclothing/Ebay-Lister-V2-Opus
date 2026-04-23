// Shared eBay title formula — used by both the initial photo-analysis
// pass in /api/generate and the style-name refine pass in
// /api/generate/refine. Keep this the single source of truth for title
// rules so prompts never drift.

export const TITLE_RULES = `TITLE FORMULA (universal, all items):
[NWT] Brand [Style Name] Item Type Gender Size Color [Tier 2 extras]

Length: MUST be 75-80 characters — use as close to 80 as possible. Pack in tier 2 extras to reach length.

SLOT RULES:
- [NWT]: include ONLY if condition is NEW_WITH_TAGS. Never include NWOT, NWD, or any other condition word. If the item is not NWT, do not start the title with any condition prefix.
- Brand: exact spelling from the tag (e.g., Nike, Patagonia, Carhartt).
- [Style Name]: the specific product line or model (e.g., 'Tech Fleece', 'Retro-X', 'Detroit Jacket', 'Crown Comfort', 'Soul Survivor Sun Protection'). Include ONLY if you can confidently identify it. Always sits between Brand and Item Type. Do NOT use as a style name: fabric technologies (Dri-FIT, HeatGear, ClimaCool, Omni-Wick), marketing adjectives alone (Pro, Elite, Premium, Performance), or style codes/SKUs (CZ1234). If no confident style name exists, skip this slot — do NOT fabricate one.
- Item Type: e.g., T-Shirt, Hoodie, Polo, Jeans, Quarter Zip, Jacket. Always AFTER the style name, never before.
- Gender: Mens, Womens, Boys, Girls, Unisex. Comes AFTER Item Type and BEFORE Size.
- Size: the tag size (e.g., Large, XL, 32x32). Comes AFTER Gender. For pants/shorts/jeans: if the 2-inch rule applies (measured waist OR inseam differs from tag by 2+ inches), use the MEASURED size here.
- Color: primary color (e.g., Black, Navy Blue, Olive Green).
- Tier 2 extras (use these to reach 75-80 chars): pattern (Plaid, Striped), premium material (Wool, Leather, Silk, Cashmere), notable features (Waterproof, Insulated, Embroidered, Full Zip, UPF, Sun Protection, Moisture Wicking, Quick Dry, Lightweight, Vented).

NEVER INCLUDE IN TITLE:
- Common fabric words: cotton, polyester, nylon, spandex, blend, stretch (already in item specifics).
- Marketing fluff: amazing, rare, great, must-have, awesome, premium (as a standalone adjective).
- NWOT, NWD, or any condition word other than NWT.
- RN numbers, style codes, SKUs.

EXAMPLES:
CORRECT: 'NWT Nike Tech Fleece Hoodie Mens Large Black Full Zip Pullover'
CORRECT: 'Patagonia Retro-X Fleece Jacket Womens Medium Natural Cream'
CORRECT: 'Carhartt Detroit Jacket Mens 42 Brown Canvas Insulated Workwear'
CORRECT: 'Peter Millar Crown Comfort Quarter Zip Mens Medium Navy Blue Waffle Knit'
CORRECT: 'Duluth Trading Soul Survivor Sun Protection Shirt Womens Large Blue UPF Vented'
WRONG: 'Nike Dri-FIT Cotton T-Shirt Mens Large Black' — Dri-FIT is tech, cotton is a banned fabric word
WRONG: 'Amazing Rare Vintage Nike T-Shirt Mens Large Black' — 'amazing' and 'rare' are banned fluff
WRONG: 'Nike T-Shirt Tech Fleece Mens Large Black' — style name must come before item type
WRONG: 'NWOT Levi 501 Jeans Mens 32x32 Blue' — NWOT never goes in a title`;
