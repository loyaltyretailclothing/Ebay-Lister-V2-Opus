# AI Pipeline

How photos become a listing. Code: `src/lib/listingPipeline.js`. See [[Overview]], [[Costs]].

## The three Claude passes (all Sonnet)
1. **Pass 1 (vision):** `analyzeListing(photos, notes)`. Reads the AI photos and returns `title_parts`, SEO-ranked `keywords` (Tier 1/2/3), a backup title, condition, observations (brand, style_name, type, gender, sizes, color…), and category keywords. The app then assembles the title. The **AI Note** is added here if present.
2. **Pass 3 (refine):** `refineStyleName`. Runs only when a style number is found and Brave is configured. Searches Brave, then asks Claude for the style name; the app rebuilds the title from the same pieces and keywords with the new style name. Runs **before** Pass 2 so specifics see the final title.
3. **Pass 2 (specifics):** `fillItemSpecifics`. Gets the category's eBay item specifics (with allowed values) and fills them from observations. This is the most expensive pass (large value lists). When the listing has keywords, Pass 2 leaves Theme empty and the app fills Theme with overflow keywords.

Order in the camera flow: Pass 1 → Pass 3 → category lookup → Pass 2 → description template.

## Title formula
Rules: `src/lib/titleRules.js`. Assembly: `src/lib/titleKeywords.js`.
`[NWT] Brand [Style Name] Item Type Gender Size Color` + SEO keywords **Tier 1 → 2 → 3**, filled to 80 characters.
- Pass 1 returns `title_parts` + ranked `keywords`; **the app assembles the title**. The AI's own `title` is only a backup.
- Overflow keywords go to **Theme**; keyword chips move them between title and Theme. Full details: [[Title Keywords Plan]].
- NWT only for New With Tags (set from condition); never NWOT/NWD in titles.
- No fabric filler words, fluff, RN numbers or style codes. Words already in the title are stripped from keywords.
- **2-inch rule** (pants/shorts): if the measured waist or inseam differs from the tag by 2+ inches, use the measured size (asterisk added once).

## Notes
- **AI Note:** sent to Pass 1. Editing it after analysis only matters if you re-analyze.
- **Draft Note:** stored on the listing for whoever finishes the draft. Never sent to the AI or eBay.
- Both live on the listing object (`aiNote`, `draftNote`), so they survive save/load and re-analysis.

## Item specifics notes
- Pass 2 is told to use eBay's preset spelling (especially Brand) and return multi-values as arrays.
- **Theme:** for listings with keywords, the app owns Theme (overflow keywords). Older listings without keywords keep the original behavior, where Pass 2 picks 2–3 Theme words itself.
- **Re-analyzing** a draft redoes everything the AI creates, including a fresh category lookup and a full item specifics refill. Typed-in fields are kept. See [[Title Keywords Plan]].
- The item specifics fetch keeps only value **lists**. It does **not** keep eBay's value dependencies (e.g. Size ↔ Size Type). That gap causes [[Size Type and Size]].
- AI can invent numeric values it can't see (e.g. Fabric Weight). See [[Item Specifics Rejections]].

## Research helpers (Create Listing page)
- **Google:** click, then pick a listing photo, which opens Google Lens with that photo.
- **eBay:** searches active listings using Brand + Style + Type pulled from the title (no size/gender/color).
- **Sold comps:** built from observations, filtered to matching condition.
