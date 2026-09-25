# Title Keywords Plan

**Status: LIVE — deployed 2026-09-16.** See [[AI Pipeline]], [[Decision Log]].

## Goal
Much stronger titles by filling the space after the color with the words buyers actually search for, not just words the AI happens to read in the photos.

## The problem found
- The photo-analysis prompt told the AI to *describe what it sees*. It never asked what buyers search for.
- The old keyword slot ("Tier 2 extras") only allowed visible things: pattern, premium material, features.
- Result: keywords only showed up when one was printed on a tag or visible in a photo.

## Title structure
`[NWT] Brand [Style Name] Item Type Gender Size Color` + **Tier 1** → **Tier 2** → **Tier 3**, filled until 80 characters.
- Tier 2 is used only when no more Tier 1 keywords fit; Tier 3 only after Tier 2.
- Banned-word rules stay (no fabric filler, no fluff, no condition words other than NWT, no RN numbers or style codes).
- Rules live in `src/lib/titleRules.js`.

## What was built

### 1. AI generates SEO-ranked keywords
- The photo analysis now also returns `title_parts` (brand, style name, type, gender, size, color) and **6–10 keywords**, each ranked:
  - **Tier 1:** most likely to be searched by buyers for *this exact item*
  - **Tier 2:** strong but secondary
  - **Tier 3:** helpful, broader
- Tiers are about search value for this item. The same word can rank differently on different items.
- Same AI call as before, **no extra call**.
- Visible details buyers search for (graphics, prints, patterns, logos, features) count as keywords.
- Brand-specific terms are allowed when true for the item.

### 2. No keyword spam
- **In the prompt:** every keyword must be true; claims (Waterproof, Cashmere, Made in USA…) need evidence in photos or tags; no other brands or "like/not X"; no repeated words; nothing misleading.
- **Enforced in code** (`src/lib/titleKeywords.js`):
  - Banned words removed
  - Duplicates removed
  - **Words already in the title are stripped** ("Sun Shirt" on a T-Shirt → "Sun"). eBay matches words anywhere in the title, so the shorter keyword matches the same searches and saves room.
  - Keywords over 30 characters dropped
  - Max 10 keywords

### 3. The app assembles the title
- The app builds the title from the pieces and fills keywords in rank order until 80 characters.
- NWT is set from the condition, not the AI.
- The 2-inch-rule asterisk is applied once (it was made safe to apply twice without doubling).
- If the AI response is missing the pieces, the AI's own title is used and no chips show.

### 4. Overflow goes to Theme only
- Keywords that don't fit go to the **Theme** item specific.
- When a listing has keywords, item specifics (Pass 2) is told to leave Theme empty so only real overflow keywords go there.
- **Categories without Theme** (e.g. sports jerseys): overflow keywords are dropped, so only title keywords remain as chips.
- **The description is not used for keywords.**

### 5. Clickable keyword chips
- Under the title, grouped by tier. Blue = in title; outlined with "Theme" = in Theme. Component: `src/components/KeywordChips.js`.
- ~~**Rule: every chip is a keyword placed in the title or Theme. No chip exists on its own.**~~ Changed 2026-09-25 — a chip can now be unused (grey) so keywords can be reviewed and rejected. See "More keywords, three-state chips" below.
- Clicking a **Theme** chip moves it into the title; lower-ranked title keywords move to Theme to make room. If it can't fit at all, a note says so and nothing changes.
- Clicking a **title** chip moves it to Theme; the title refills with the best others that fit.
- The app does this, not the AI: instant and free.
- Chips are disabled while item specifics are loading or filling.
- Removing a keyword from the Theme dropdown by hand also removes its chip.
- Theme values you add by hand (not keywords) are kept when chips are clicked.
- A note warns that clicking a chip rebuilds the title and replaces typed edits.

### 6. Title ↔ description sync
- Whenever the title changes (chip click or typing), the **first line of the description** updates to match. Nothing else in the description changes.

### 7. Scope
- **Both** the Create Listing and Camera flows. The style-name lookup rebuilds the title from the same pieces and keywords.
- **Existing drafts are untouched:** same title, same Theme, no chips.
- Publishing is unchanged.

## Decided against (for now): keyword log
The AI can rank keywords well without a log. Asking the question was the real fix. A log would have added an extra AI step, a shared file two people could overwrite, a page to build, and a risk of repeating bad keywords with no way to delete them. Revisit if titles seem inconsistent or good keywords get missed.

## Cost
About **+$0.003 per analysis** (keyword rules in the prompt + ~10 keywords returned). Chips, assembly, and description sync are $0. About +$1/month at 400 listings. See [[Costs]].

## Verified 2026-09-16 (local, nothing saved)
- 28 logic tests passed: tier order, spam filters, repeat stripping, chip moves never lose a keyword, no-Theme categories, asterisk never doubled, description sync, old drafts untouched.
- Production build clean; no console or server errors.
- An existing draft loaded unchanged, with no chips.
- Two live analyses on an existing draft's photos (not saved): title assembled, chips shown by tier, chip clicks moved keywords correctly, description stayed in sync. The first run found the "Shirt Shirt" repeat problem, which is now fixed.
- **Not live-tested:** the Camera flow, because testing it would create a real draft. It's covered by the shared logic and tests.

## Re-analyze = redo the listing (added 2026-09-16)
Found while testing: re-analyzing a draft that already had a category cleared item specifics and never refilled them, leaving Theme empty. Fixed by making **Analyze Photos on a draft start the listing over from the photos**:
- **The AI redoes:** title, keywords, condition, description, **category** (looked up fresh), and **all item specifics** including Theme.
- **Kept:** photos, AI Note, Draft Note, price, Best Offer, promotion, SKU, weight, dimensions, policies, schedule.
- **Same draft, nothing auto-saved:** review the result and click **Update Draft** to save (Option A). Leave without saving to discard.
- **Confirmation first:** "Redo this listing from the photos?", so a stray click can't replace a finished listing.
- **Cost:** a normal full analysis (~$0.07–0.08).
- **How:** each analysis sets `analysisRun`, which re-runs the category lookup even if the AI returns the same category keywords; category and item specifics are cleared so they refill.

Verified locally (not saved): Cancel changed nothing; OK redid the J.Crew draft, the category was looked up again, 28 item specifics refilled, Theme held exactly the overflow keywords, the description matched the title, and the SKU and all other typed fields were unchanged.

## More keywords, three-state chips (2026-09-25)

**Why.** Users compared our keywords with a Google answer for the same Mizzen+Main Helmsman shorts and Google's list was far richer. The cause wasn't the model — it was our own rules: "stretch" was on the banned list (so "4-Way Stretch" was thrown away), every claim needed visible evidence (so nothing the model is known for could be used), and we only asked for 6-10 keywords. Users also saw junk chips like "Size" and "Neck".

### Measured before changing (A/B, same 3 items, 2026-09-25)
Current rules vs proposed, run twice (second run with tightened wording). Raw results in the session scratchpad.

| | Current | Proposed |
|---|---|---|
| Keywords returned | 7 | 16-17 |
| Cost per analysis | $0.0217 | $0.0247 (**+$0.003**, ~$1.35/month) |

Examples the new rules found and the old ones could not: 4-Way Stretch, Moisture Wicking, Quick Dry, Wrinkle Resistant (Mizzen+Main); Layering Vest, Fall Sweater, Winter Vest, Big And Tall (Duluth vest); Wedding, Formal Wear, Office Wear, Tailored Fit, Dress Blazer (RL blazer). The first (verbose) run also produced a wrong "Wool Blend" on a Shetland wool vest — the risk of model knowledge; the tightened run didn't.

### What changed
1. **Prompt** (`titleRules.js`): 12-15 keywords; explore several angles (purpose/activity, fit and cut, performance features, construction, look and occasion, brand lines); model knowledge allowed **only** when brand AND style name are confidently identified; performance phrases (4-Way Stretch, Moisture Wicking, Quick Dry, Wrinkle Resistant, Breathable, Water Repellent, UPF) are keywords, bare fabric names still banned; every keyword must stand alone — never a slot word, never a fragment.
2. **Filters** (`titleKeywords.js`): "stretch" off the banned list, but banned **alone** (with print, knit, lined, zip, pocket). New scrap filter: after repeated words are stripped, a keyword left as a fragment (size, neck, fit, style, type, colour, cut, length, waist, inseam…), a bare number or a size (XL, 32x32) is dropped — this is what produced the "Size" and "Neck" chips. Cap raised 10 → 15 (eBay allows 30 values in a multi-value specific).
3. **Three-state chips**: **blue** in title, **green** in Theme, **grey** unused. Desktop: left-click puts an unused keyword in the title or takes a used one out; right-click sends it to Theme. Phone: tap cycles title → Theme → unused. Keywords that fit nowhere are kept as grey chips instead of being dropped.

### Verified locally 2026-09-25 (nothing saved)
- Filters: "Size 34", "XL", bare "Stretch", "Cotton" dropped; "4-Way Stretch", "Moisture Wicking" kept; "Golf Shorts" → "Golf".
- Desktop on a real draft (writes blocked): left-click removed a title keyword and the title refilled; right-click moved it to Theme; left-click from Theme removed it; left-click on grey put it back in the title.
- Phone: tap cycled blue → green → grey → blue.
- Existing drafts are untouched until re-analyzed.
