# Description Plan

**Status: both templates built, not wired in (2026-09-29).**
`buildTopDescription` and `buildBottomDescription` in
`src/lib/descriptionTemplate.js` are written and tested but nothing calls them
— the app still builds the old description through `applyDescriptionTemplate`.
See [[AI Pipeline]], [[AI Notes Plan]].

**Ships as one release** (users' call 2026-09-29): these templates + the flaws
feature. None of it goes out alone.

(A `temperature: 0` change was part of this release until 2026-10-04, when the
first real API call showed `claude-sonnet-5` rejects the parameter outright.
Removed. See [[Release - Descriptions and Flaws]].)

## Goal
A description that reads like a shop wrote it, not a form. Tops first;
bottoms get their own template later, because the measurements that matter
are different.

## Tops
Shirts, polos, tees, jumpers, hoodies, jackets, coats — everything above the
waist takes the same two measurements, so they share one shape. `isTop`
excludes shorts explicitly, since "shorts" contains "short".

```
Tommy Bahama Crew Neck Sweater Mens M Burgundy Ribbed Pullover Knit

Crew Neck Pullover Sweater with ribbed cuffs and hem. 90% Cotton, 10% Nylon.

Measurements
Tag size: M
Chest 42" · Length 27"

Condition — Pre-owned, excellent
Flaws: Small pill on the left cuff
Picture included in the photos.

Style T324567 · Ships USPS Ground Advantage
Compare these measurements with something in your own wardrobe for the best fit.
```

## The rules behind it
- **Three things are bold**, as `<b>` tags: the title line, the
  **Measurements** heading and the **Condition** label. The listing route
  passes HTML through and turns newlines into `<br>`
  (`api/ebay/list/route.js`), so they render on eBay. Confirmed 2026-10-02.
  **The trade, accepted:** the app's Description field is a plain textarea, so
  the tags are visible while editing — which now happens on every listing with
  a white-arrow flaw, since the [[Flaws Plan|Flaws box was dropped]] in favour
  of editing the description directly. Storing it plain and adding tags at
  send time was considered and rejected: what you see should be what goes out.
- **Tag size sits above the tape numbers.** It's what the buyer searched for
  in the title; the measurements are there to check it against.
- **Tag size shows even with no measurements at all** (2026-09-29). It's the
  one size fact we have. The "Measurements" heading is dropped in that case —
  a heading over a single line that isn't a measurement reads wrong.
- **No "laid flat".**
- **Flaws are always stated.** A flaw is named; no flaw prints `None`.
  Silence reads as an oversight.
- **One photo line under the whole flaw list** (2026-09-29), not one per
  flaw: "Picture included in the photos." / "Pictures…" for more than one.
  Nothing is added when there are no flaws — pointing at photos of flaws that
  don't exist only confuses people.
- **Nothing is estimated.** A measurement the AI didn't read off the photos
  doesn't appear. Missing pieces are left out rather than padded.
- **No seller note in the description** (2026-09-29). The Draft Note is for
  whoever finishes the draft and has never gone to eBay. An `extraNote`
  parameter existed briefly and was removed so it can't leak in later.

## Bottoms
Pants, jeans, shorts, trousers, chinos, joggers, sweatpants, leggings, slacks,
khakis. Matched on **whole words**, because "Short Sleeve Shirt" contains
"short" and is not a pair of shorts — that was a real bug in `isTop`, fixed
2026-09-29. **Skirts are in neither list** (no inseam) and stay on the old
template until we design them.

Three measurements, the ones the seller takes: **waist, rise, inseam.**

```
Duluth Trading Fire Hose Pants Mens 32x30* Gray Flex Work Canvas

Flex Pants with a gusseted crotch. 98% Cotton, 2% Spandex.

Measurements
Tag size: 34x30
Waist 32" · Rise 11" · Inseam 30"

Condition — Pre-owned, excellent
Flaws: Small snag above the left knee
Picture included in the photos.

Ships USPS Ground Advantage
Compare these measurements with something in your own wardrobe for the best fit.
```

- **A letter-sized bottom shows the tag letter as the waist**, not the tape
  number: `Waist M · Rise 11" · Inseam 29"` (users' call 2026-09-29). Letter
  sizes nearly always mean a stretch waistband, so the relaxed tape number
  reads as mismarked and costs the sale. Rise and inseam are fixed cloth and
  stay in inches.
- **The word "elastic" is deliberately not used yet.** The users want to check
  by hand whether a letter size means an elastic waist every time before the
  description claims it.
- **No line explains the `*`** (users' call 2026-09-29). Tag above measured
  says it.
- **Rise never comes from the AI's guess.** The AI returns rise as
  Low/Mid/High from the photos; only a measured number is ever printed.
- **Every listing has measurements**, so the tag-size-only fallback should
  never fire in practice. If it does, the AI failed to read measurements that
  were photographed — `notes_for_seller` already flags "no measurements are
  visible" as a check-this note. The closet line stays off in that case
  rather than pointing at measurements that aren't there.

## Still open
1. **The opener sentence.** Today it's observation fields glued together, and
   it reads like it — worst when the AI only got a type, which gives a bare
   "Tee." Proposal: have Pass 1 write the one sentence. ~40 input + ~30 output
   tokens = **$0.0004 a listing**, about 16¢/month at 400 listings, 8¢ through
   the batch queue. Roughly 1% on top of the measured 3.4¢ ([[Costs]]).
2. ~~**Are the measurements actually being read?**~~ **Answered 2026-10-02.**
   41 real drafts audited read-only: tops 14/14 on both chest and length,
   bottoms 24/25 waist and 23/25 inseam after a parsing bug was fixed. Rise
   shows on 1/25 because the sellers don't measure rise on shorts, which is
   nearly all of this batch. [[Future Features|8a]] is built — five named
   numbers, with the old hunt kept as a fallback for drafts saved earlier.
   Details and the bug in [[Release - Descriptions and Flaws]].
3. **`Tag size: L` then `Waist L`** repeats the letter on consecutive lines.
   It answers the waist question instead of leaving a gap, which is why it's
   there, but it may read oddly after a few dozen listings. Easy to drop the
   tag line when the waist already carries the letter.

## Blocker: the flaws system — now designed, see [[Flaws Plan]]
The Flaws list is user-edited and seeded by the AI. Today the AI already
writes flaws but under whatever key it feels like — `fading`,
`condition_details`, `flaws` — and nothing reads them. Needed:
- A **Flaws box** on the draft, seeded by the AI, corrected by eye, so what
  prints has been looked at.
- Then the **coloured-magnet markers** (4 colours, placed beside the flaw when
  photographing). Undecided: whether marker photos go to buyers or stay
  AI-only.
