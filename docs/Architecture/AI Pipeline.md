# AI Pipeline

How photos become a listing. Code: `src/lib/listingPipeline.js`. See [[Overview]], [[Costs]].

## The three Claude passes (all Claude Sonnet 5, thinking off — since 2026-09-18; was Sonnet 4.6. See [[Costs]])
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
- **Size comes from the tag** (2026-09-29). The size in the title and in `observations.size` is what the tag says — the AI must never substitute a size it inferred from a measurement. A shirt tagged M with a 48" chest is still an M; the disagreement goes in the check-this notes instead.
  - **Why:** the AI had been doing exactly that. A Tommy Bahama jumper went out titled **Large** while its tag said **M** and the AI's own `size` field said Medium. The prompt stated the 2-inch rule as "(pants/shorts/jeans only)" and the model generalised the principle — trust the measurement over the tag — to tops. The code couldn't stop it: `titleParts.size` comes straight from the AI and nothing cross-checked it.
- **2-inch rule** — the single exception, narrowed 2026-09-29 to **trousers, jeans and shorts whose tag size is a waist × inseam number** such as `32x30`. Never on anything sized S/M/L/XL, never on a top. If the measured waist or inseam differs by 2+ inches, the measured size is used (asterisk added once).
  - `checkTwoInchRule` already enforced the numeric part — `parsePantSize` only understands `32x30`, so letter-sized shorts could never trigger it. The leak was the prompt, not the code.
  - **Reads the shapes the AI actually writes** (2026-09-29). It used to understand only `32x30`, so it was dead on every pair of shorts — the AI writes `"Waist 27, Inseam 7"`, `W32`, `Men's 33`. `parseBottomSize` reads all of those and returns `{waist, inseam}` with null for anything not stated.
  - **Only what both sides state is compared.** Shorts often have a waist and no inseam, so a missing inseam means the rule runs on the **waist alone** rather than not running (users' call 2026-09-29). An inseam the tag never claimed can't disagree with anything.
  - **When it fires, the whole measured size goes in the title**, not just the half that was out: tag `32x32` measuring `30x31` is titled `30x31*`. The asterisk is there to catch the buyer's eye and appears only when the rule fires.
  - **The shape follows the tag.** A tag reading `W34` gives `31*`, not `31x9*` — that's how the size reads on the garment, even when an inseam was measured.
  - **The code writes that size, the AI doesn't.** `titleSizeOverride` decides it in `buildBaseTitle`. Before this, the app only added an asterisk to whatever size the AI had already written, so a model that put the *tag* size in the title made the rule fire and achieve nothing — no asterisk, wrong size shown.

## Notes
- **AI Note:** sent to Pass 1. Editing it after analysis only matters if you re-analyze.
- **Draft Note:** stored on the listing for whoever finishes the draft. Never sent to the AI or eBay.
- Both live on the listing object (`aiNote`, `draftNote`), so they survive save/load and re-analysis.

## Brand sends no value list (2026-09-28)
eBay's value lists are alphabetical and Pass 2 can only afford the first 200. For Brand that means "everything starting with a digit or A" — 200 of **9,130** on shirts, of 19,161 on polos. Measured across 30 real drafts: the chosen brand was inside those 200 exactly **7 times, 4 of them "Unbranded"**. The only real ones were 5.11 Tactical and 7 For All Mankind, which sort early because they start with digits. The other 23 came from the AI reading the tag — Proper Cloth sits at #13,980 in eBay's list.

A FREE_TEXT field with more than 500 values now sends no list (`sendableValues` in `listingPipeline.js`). Only Brand crosses that line in the categories they list; Model, the next largest, has 363. **Everything eBay actually constrains (SELECTION_ONLY) keeps its values**, as do short free-text lists like Color (17) and Material (58) — users' call 2026-09-28: "I want AI to use the selections Ebay gives us."

The Brand rule in `SPECIFICS_SYSTEM_PROMPT` was rewritten to match: it used to say "search the values list carefully before using a custom value", which means nothing when there is no list, and now says a missing list is never a reason to answer "Unbranded".

**Saving:** 14–20% of the Pass 2 prompt (Sweaters 12,672 → 10,146 chars; one shorts category 16,062 → 13,787). Roughly $2/month.

**What the test did NOT show.** 4 of 30 saved drafts have Brand "Unbranded", including a Johnnie-O and a Birddogs, so the failure is real in production — but it could not be reproduced on demand. One baseline run got all three wrong; an identical second run got all three right, and 5 further runs per arm (30 calls) were right every time in **both** arms. **The change is justified by cost, not by proven accuracy.** Other fields moved no more than normal noise: two identical runs differed on 16 of 248 fields, old vs new on 22 of 248. Test cost ~$0.80 of AI.

## Item specifics notes
- Pass 2 is told to use eBay's preset spelling and return multi-values as arrays. Brand is the exception above.
- **Theme:** for listings with keywords, the app owns Theme (overflow keywords). Older listings without keywords keep the original behavior, where Pass 2 picks 2–3 Theme words itself.
- **Re-analyzing** a draft redoes everything the AI creates, including a fresh category lookup and a full item specifics refill. Typed-in fields are kept. See [[Title Keywords Plan]].
- The item specifics fetch keeps only value **lists**. It does **not** keep eBay's value dependencies (e.g. Size ↔ Size Type). That gap causes [[Size Type and Size]].
- AI can invent numeric values it can't see (e.g. Fabric Weight). See [[Item Specifics Rejections]].

## Research helpers (Create Listing page)
- **Google:** click, then pick a listing photo, which opens Google Lens with that photo.
- **eBay:** searches active listings using Brand + Style + Type pulled from the title (no size/gender/color).
- **Sold comps:** built from observations, filtered to matching condition.
