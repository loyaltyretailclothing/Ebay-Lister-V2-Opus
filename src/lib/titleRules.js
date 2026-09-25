// Shared eBay title formula — used by the photo-analysis pass and the
// style-name refine pass. Keep this the single source of truth for title
// rules so prompts never drift.
//
// The AI returns the title as PIECES (title_parts + ranked keywords) and the
// app assembles the final title in src/lib/titleKeywords.js. That keeps the
// formula and the 80-character fill exact, and lets the keyword chips on the
// listing page move keywords between the title and the Theme item specific.

export const TITLE_RULES = `TITLE FORMULA (universal, all items):
[NWT] Brand [Style Name] Item Type Gender Size Color [Keywords]

The app builds the final title from your title_parts and keywords: it writes the slots in order, then adds your keywords best-first (all Tier 1, then Tier 2, then Tier 3) until the title reaches 80 characters. Keywords that don't fit go into the Theme item specific.

SLOT RULES:
- [NWT]: include ONLY if condition is NEW_WITH_TAGS. Never include NWOT, NWD, or any other condition word.
- Brand: exact spelling from the tag (e.g., Nike, Patagonia, Carhartt).
- [Style Name]: the specific product line or model (e.g., 'Tech Fleece', 'Retro-X', 'Detroit Jacket', 'Crown Comfort', 'Soul Survivor Sun Protection'). Include ONLY if you can confidently identify it. Do NOT use as a style name: fabric technologies (Dri-FIT, HeatGear, ClimaCool, Omni-Wick), marketing adjectives alone (Pro, Elite, Premium, Performance), or style codes/SKUs (CZ1234). If no confident style name exists, leave it out — do NOT fabricate one.
- Item Type: e.g., T-Shirt, Hoodie, Polo, Jeans, Quarter Zip, Jacket.
- Gender: Mens, Womens, Boys, Girls, Unisex.
- Size: the tag size (e.g., Large, XL, 32x32). For pants/shorts/jeans: if the 2-inch rule applies (measured waist OR inseam differs from tag by 2+ inches), use the MEASURED size here.
- Color: primary color (e.g., Black, Navy Blue, Olive Green).

KEYWORDS — SEO: the words eBay buyers type into search for THIS item:
- First identify exactly what the item is from the photos. Then think like a buyer searching eBay for this exact item: what would they type? Those search terms are your keywords.
- Distinctive VISIBLE details buyers search for are keywords too: graphics and prints (e.g. Graphic, Fish Print, Floral), patterns (Plaid, Striped), logos (Embroidered Logo), and notable features (Full Zip, Snap Front, Vented, Pockets). Don't leave out what makes this item stand out.
- Rank every keyword by SEARCH VALUE for this item:
  - Tier 1: the terms buyers are MOST likely to search for this exact item.
  - Tier 2: strong but secondary search terms.
  - Tier 3: helpful broader terms.
  Tier is about search value for THIS item, not the kind of word — the same word can be Tier 1 on one item and Tier 3 on another.
- Return 12 to 15 keywords, best first. Each keyword is 1-3 words, at most 30 characters, in Title Case.
- EXPLORE several angles buyers search from: purpose or activity, fit and cut, performance features, construction details, look and occasion, and the brand's own named lines.
- MODEL KNOWLEDGE: when the brand AND style name are confidently identified, use what that model is known for (fabric technology, fit, intended use) even if not visible. Otherwise stick to what you can see.
- Performance phrases (4-Way Stretch, Moisture Wicking, Quick Dry, Wrinkle Resistant, Breathable, Water Repellent, UPF) ARE keywords when true; bare fabric names are not.
- Every keyword stands alone — a phrase a buyer types. Never a slot word (brand, style name, item type, gender, size, color), never a fragment (Neck, Size, Fit, Style, Type).
- Brand-specific terms that buyers search for this brand (a brand's named fit, fabric line, collection, or logo style) are good keywords when they truly apply to this item.
- NO KEYWORD SPAM:
  - Every keyword must be TRUE for this item.
  - Keywords that claim a material, feature, or origin (e.g. Waterproof, Cashmere, Wool, Leather, Made in USA, Selvedge, Insulated, UPF) require visible evidence in the photos or tags. If you can't see it, don't claim it.
  - Never include another brand's name, and never "like X", "not X", "style of X", or "similar to X".
  - Never repeat a word that is already in the brand, style name, item type, gender, size, or color, and never repeat the same keyword twice.
  - Never use misleading or unrelated words.

NEVER INCLUDE IN TITLE OR KEYWORDS:
- Bare fabric names: cotton, polyester, nylon, spandex, blend (already in item specifics). Performance phrases like 4-Way Stretch or Moisture Wicking ARE allowed as keywords.
- Marketing fluff: amazing, rare, great, must-have, awesome.
- NWOT, NWD, or any condition word other than NWT.
- RN numbers, style codes, SKUs.

EXAMPLES (title_parts + keywords → assembled title):
- Nike Tech Fleece Hoodie Mens Large Black, NWT, keywords [Full Zip (T1), Sportswear (T2), Athleisure (T3)]
  → 'NWT Nike Tech Fleece Hoodie Mens Large Black Full Zip Sportswear Athleisure'
- Brooks Brothers Oxford Shirt Mens XL Blue, keywords [Button Down (T1), Non-Iron (T1), Preppy (T2), Business Casual (T3)]
  → 'Brooks Brothers Oxford Shirt Mens XL Blue Button Down Non-Iron Preppy'
WRONG keywords: 'Cotton' (banned fabric word), 'Like Ralph Lauren' (another brand), 'Shirt' (repeats item type), 'Waterproof' with no evidence in photos.`;
