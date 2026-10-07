# Release — Descriptions and Flaws

**One release, five parts, nothing ships alone.** Agreed 2026-09-29.
**Waiting on the magnetic arrows to arrive** — a few days out.

Detail lives in [[Description Plan]] and [[Flaws Plan]]; this note is the
checklist of what goes out together and why it can't be split.

## Why it's one release
Each part is useless or harmful without the others:
- The **templates** print `Flaws: None` on everything until 8b ships —
  including on a shirt with a hole in it.
- **8a** adds five fields nothing reads unless the templates ship.
- The **templates** guess at the AI's wording unless 8a ships.
- **`Flaws: None` is a claim**, and it is only true once the arrows are in
  use. The release and the arrows are the same event.

## The five parts

| # | What | Status |
|---|---|---|
| 1 | ~~`temperature: 0` on all three AI passes~~ | **REMOVED — it would have broken every AI call. See below.** |
| 2 | Tops + bottoms description templates | **Done**, in the working tree |
| 3 | 8a — five named measurement numbers | **Done**, in the working tree |
| 4 | 8b — named `flaws` field + the colour key in the prompt | **Done**, in the working tree |
| 5 | The post block and the wiring | **Done**, in the working tree |

### 1. temperature: 0 — REMOVED 2026-10-04, it was never valid
**`temperature` does not exist on `claude-sonnet-5`.** Sampling parameters
(`temperature`, `top_p`, `top_k`) were removed on that model generation and
the API rejects them outright:

> `400 invalid_request_error: "temperature is deprecated for this model."`

Had this shipped, **every AI call in the app would have failed** — camera,
batch, Analyze now, all of it. It was caught on 2026-10-04 by the first real
API call of the whole release; nothing in lint, build or any unit test could
have found it, because none of them talk to Anthropic.

**The reasoning behind it was also wrong.** The Brand A/B test of 2026-09-28
— one run getting three brands wrong, an identical re-run getting them right
— was blamed on "temperature 1.0". There is no temperature on this model, so
that variation came from somewhere else and is still unexplained.

**If run-to-run consistency is worth chasing later**, the lever that does
exist on Sonnet 5 is `output_config: { effort: low|medium|high|xhigh|max }`
(default `high`). Not attempted, not measured, and not part of this release.

### 2. The templates — done
`descriptionTemplate.js`: `buildTopDescription`, `buildBottomDescription`,
`bottomMeasures`, `isTop` / `isBottom`, `flawLines`, shared `buildBody`.
Full rules and examples in [[Description Plan]]. Also fixes a real bug — a
"Short Sleeve Shirt" was being classed as a pair of shorts.

### 3. 8a — named measurement numbers — done 2026-10-02
`observations.measurements`: `chest_in`, `length_in`, `waist_in`, `rise_in`,
`inseam_in`. **Whole inches, a plain number, null when not measured**, never
estimated (users' call 2026-10-02 — they don't work in half inches).
`measured_size` is still filled, because the saved drafts depend on it; `rise`
stays the Low/Mid/High guess for eBay's item specific, and `rise_in` is the
tape. A measurement the AI can't read now raises a `notes_for_seller` note
naming which one — the sellers measure every item, so a gap means it was
photographed and unreadable, not absent.

**The 2-inch rule now does its sums on the named numbers** (users' call
2026-10-02), falling back to the written sentence for drafts saved earlier.
Same rule, same threshold, same asterisk — it just can't misread a sentence
it never looks at.

**The old rummaging is kept as a fallback** and is load-bearing: drafts saved
before this deploys have no named fields.

#### The audit that prompted it (2026-10-02, read-only, 41 real drafts)
- **Tops: chest 14/14, length 14/14.** The rummaging was already fine there.
- **Bottoms: waist 24/25, inseam 20/25** before the fix, **23/25** after.
- **Rise 1/25 — not a fault.** The sellers don't measure rise on shorts, and
  these were nearly all shorts. It'll matter on pants and jeans.
- One draft (5.11 Tactical) had its measurements filed under `tag_size` with
  `measured_size` empty — the kind of mis-filing named slots prevent.

#### A real bug it found, fixed in the same change
`parseBottomSize` allowed up to six characters between a label and its number,
which was enough to hop a comma: **`"34 waist, 7 inseam"` read the waist as
7**. The 2-inch rule then fired against a tag of 34 and `titleSizeOverride`
produced **`7*`** — a title reading "Shorts Mens 7*". Two saved drafts were
affected (Lululemon Commission `7*`, Patagonia All Wear `6*`); after the fix
the rule fires on one bottom out of 25, correctly. `labelledInches` now binds
a label only to the number beside it and understands both word orders.

**This bug is in commits `0eb113b`/`fce7d76`, which are live.** It ships fixed
with this release rather than separately (users' call 2026-10-02 — let it sit
and roll it out with the update). Until then a wrong size is visible on the
draft before listing, so it is caught by review rather than silent.

### 4. 8b — the flaws field — done 2026-10-02
A named `flaws` field at the top of the vision reply, plus the arrow colour
key and seven absolute rules in the prompt: only arrowed flaws are reported,
no arrows means an empty array, the colour decides the kind, never say how big
anything is, same-coloured arrows merge into one line, white returns no text
and never merges, and `photo` uses the existing "AI photo N" numbering.

Full shape, reasoning and the code in [[Flaws Plan]]. The one thing worth
repeating here: **the AI writes the sentence** (no templates), because nothing
parses this text — a buyer reads it — so variation is cosmetic, unlike the
measurements where it broke code.

### 5. The block and the wiring — done 2026-10-02
**No Flaws box** — the flaws go straight into the description, which is
already editable (users' call 2026-10-02). See [[Flaws Plan]].

- `applyDescriptionTemplate` now routes **tops** to `buildTopDescription`,
  **bottoms** to `buildBottomDescription`, and everything else — skirts,
  non-clothing — to the original `buildDescription`. Until this, both new
  templates were dead code: nothing called them, which is what kept the whole
  thing invisible to Shannon while it was being designed.
- **The block** lives in `missingRequired` (`listingDefaults.js`), beside
  title, category, price and SKU. List on eBay is disabled while a ⚠ is
  anywhere in the description, and the button's tooltip says why — a disabled
  button with no reason is worse than no block.

**A bug caught while testing this:** the block didn't fire, because by the
time the placeholder reaches the description a bullet sits in front of it and
`isFlawTodo` only looked at the start of the line. It now looks anywhere in
the line; the marker appears nowhere else.

## Build order
3 → 4 → 5. Parts 1 and 2 are already done and waiting.

## Before pushing
- `npm run build` clean (repo rule: build before commit).
- **Don't push while Shannon is working** — main deploys straight to Vercel.
- Watch the first batch of ~20 listings, specifically: brands coming back
  Unbranded or plainly wrong on tags a person can read (that's the temperature
  change), and any listing printing no measurements (that's 8a's fallback).

## First real API call — 2026-10-04
Three photos with **no arrows on them**, through the real prompt. Testing rule
1 of the flaws system: does the AI stay quiet about flaws nobody marked? That
rule is what makes `Flaws: None` mean anything, and it is the one most likely
to break, because the model's instinct is to be helpful.

| Checked | Result |
|---|---|
| `flaws` array | `[]` — nothing invented |
| flaws leaking into `notes_for_seller` | none; the two notes were about a missing size tag and mixed garments |
| `measurements` shape | all five keys present, all `null` — no tape in the photos, nothing estimated |
| `measured_size` | `null`, correctly |

**Rules 1 and 2 hold on a real call, and 8a returns the right shape.**

Cost: **$0.027** for the one call (8,655 in / 928 out). Higher than a normal
analysis because the test sent full-size images; the pipeline resizes to 600px
first.

**Caveat:** the three photos were of different garments, so the model flagged
that it might be looking at two items — a fair note, and a flaw in the test
rather than in the app. **The positive case — arrows actually on a garment —
is still untested.**

## Deployed 2026-10-04, and what the first days found
Pushed as `f536407` and then fixed in place across `4de0ebf`, `055383b`,
`3f50024` and `6390cc0`. Everything below was found by using it, not by
reading it:

- **`temperature: 0` would have broken every AI call** — caught by the first
  real API call, hours before deploying.
- **Send To Queue was dead on any fresh listing** — it keyed on a draft that
  did not exist yet.
- **The AI invented flaws** on an unmarked garment, because three older parts
  of the prompt still told it to hunt for them.
- **It recited the colour key** — "Hole or tear at the left cuff" — and drifted
  into the next colour's meaning.
- **The arrows are purple, not orange**, so that colour was being silently
  dropped.
- **The opening sentence and the style-number line** were cut after reading a
  real listing.

Details of each in [[Flaws Plan]] and [[Description Plan]].

## Still untested, and only real photos can answer
- **Colour accuracy in real lighting** — lime vs green, and any arrow against a
  same-coloured garment.
- **White-on-white** — a white arrow on a cream garment may not be seen, which
  is the exact case where missing it costs a return. Proposed safety net: a
  "white arrow used" toggle on the camera review screen. Not agreed.
- **Do the templates find real measurements?** Every example so far used
  numbers typed by hand. 8a should make this moot; worth confirming anyway.

**Ten-minute test once the arrows arrive:** one arrow of each colour on one
garment, one analysis. Answers the colour question and shows how the AI words
position, before the box is built around either.
