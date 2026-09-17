# AI Pipeline

How photos become a listing. Code: `src/lib/listingPipeline.js`. See [[Overview]], [[Costs]].

## The three Claude passes (all Sonnet)
1. **Pass 1 (vision):** `analyzeListing(photos, notes)`. Reads the AI photos and returns title, condition, observations (brand, style_name, type, gender, sizes, color…), category keywords. The **AI Note** is added here if present.
2. **Pass 3 (refine):** `refineStyleName`. Runs only when a style number is found and Brave is configured. Searches Brave, then asks Claude for the style name. Runs **before** Pass 2 so specifics see the final title.
3. **Pass 2 (specifics):** `fillItemSpecifics`. Gets the category's eBay item specifics (with allowed values) and fills them from observations. This is the most expensive pass (large value lists).

Order in the camera flow: Pass 1 → Pass 3 → category lookup → Pass 2 → description template.

## Title formula
Single source of truth: `src/lib/titleRules.js`.
`[NWT] Brand [Style Name] Item Type Gender Size Color [Tier 2 extras]`, 75–80 characters.
- NWT only for New With Tags; never NWOT/NWD in titles.
- No fabric filler words, fluff, RN numbers or style codes.
- **2-inch rule** (pants/shorts): if the measured waist or inseam differs from the tag by 2+ inches, use the measured size.

## Notes
- **AI Note:** sent to Pass 1. Editing it after analysis only matters if you re-analyze.
- **Draft Note:** stored on the listing for whoever finishes the draft. Never sent to the AI or eBay.
- Both live on the listing object (`aiNote`, `draftNote`), so they survive save/load and re-analysis.

## Item specifics notes
- Pass 2 is told to use eBay's preset spelling (especially Brand), use Theme as an SEO overflow field, and return multi-values as arrays.
- The item specifics fetch keeps only value **lists**. It does **not** keep eBay's value dependencies (e.g. Size ↔ Size Type). That gap causes [[Size Type and Size]].
- AI can invent numeric values it can't see (e.g. Fabric Weight). See [[Item Specifics Rejections]].

## Research helpers (Create Listing page)
- **Google:** click, then pick a listing photo, which opens Google Lens with that photo.
- **eBay:** searches active listings using Brand + Style + Type pulled from the title (no size/gender/color).
- **Sold comps:** built from observations, filtered to matching condition.
