# Flaws Plan

**Status: designed 2026-09-29, nothing built.** Ships with [[Description Plan]]
as one release. See [[AI Pipeline]], [[AI Notes Plan]].

## Why this works when the last attempt didn't
Aaron tried AI flaw-reading a long time ago and dropped it: *"it could never
get them right."* It was being asked to do two hard jobs — **find** the flaw
and **judge** what it was — and it missed real holes while inventing pilling
that wasn't there.

Aaron bought magnetic arrows (2026-09-29). The seller places one beside each
flaw, and the colour says what kind it is. That removes both hard jobs. The AI
only reads a colour and says where the arrow points, which is the kind of work
it is reliably good at.

**The bigger win: no arrow means no flaw.** The AI no longer has to decide
whether a shadow is a stain. Flaws are marked; anything unmarked is not a
flaw. That is what makes `Flaws: None` a statement instead of a guess, and it
is what stops invented flaws.

## The colours (Aaron's call 2026-09-29; superseded by the words, 2026-10-06)
Each colour allows a **short list of words**, and the AI picks exactly **one**
of them — whichever matches what it can see.

| Colour | Pick one of | |
|---|---|---|
| Red | hole / tear / rip | |
| Orange | stain / discoloration | |
| Blue | pilling / fabric wear | |
| Green | fading | |
| Black | name the part | broken or missing button, zip pull, drawstring |
| **White** | **nothing** | **a real flaw, but the seller writes the words** |

**Never two words joined by "or"**, and never a word from another colour's
list. Those are two different faults and both turned up on the first real
test (2026-10-05): the hedging — *"Hole or tear at the left cuff"*, *"Pilling
or fabric wear at the left side seam"* — which reads badly to a buyer; and a
**green** arrow described as *"Fabric wear visible near pocket opening"*,
which is blue's meaning. Reciting the list is what let it drift.

A single fixed word per colour was tried first and rejected the same day: it
would have called every STAIN arrow a stain even when the mark was plainly
discoloration. **Picking one from a list is not the same as reciting the
list** — the first is accuracy, the second is hedging.

**It was briefly recorded as purple** (2026-10-05), from hearsay rather than
the arrows themselves. Corrected to orange on 2026-10-06 when the finished set
was photographed. The lesson is worth keeping: `cleanFlaws` drops anything it
does not recognise, so a key that disagrees with the physical arrows fails
silently — nothing errors, the flaw simply never appears.

## The word is the signal — BUILT 2026-10-06
The arrows are made and the code reads them. `flaws` entries now carry a
**word**, not a colour:

```json
{ "word": "HOLE", "photo": 3, "where": "left cuff",
  "text": "Tear at the left cuff." }
```

`cleanFlaws` accepts eight words — **hole, stain, wear, fade, snag, zip,
button, see note** — and drops anything else, the same way it used to drop an
unknown colour. The colour is kept on the entry, derived from the word, purely
so a blurred word can still be placed.

**Merging moved from the colour to the word.** Two BUTTON arrows become one
line; a ZIP and a BUTTON stay separate even though both are black.

**The border is never the colour.** Every arrow has a contrasting border so it
shows against the fabric — white edging on the dark bodies, black on the
yellow and white ones. That only matters in the fallback case, but it matters
a lot there: a red HOLE arrow read by its *white edge* becomes "white", which
maps to SEE NOTE, losing the flaw type and blocking the listing instead. And
the set contains the exact confusable pair — **white body with black border**
(SEE NOTE) against **black body with white border** (ZIP, BUTTON), each the
other's inverse. The prompt says it plainly: the colour is the wide middle
where the word is, never the edge.

**Measured at the size the AI is actually sent** (600px, quality 70): all
fourteen arrows read correctly, every word and every colour, including
`SEE NOTE` on one line. That settles the sizing question — the words are
comfortably legible and the single-line SEE NOTE is fine after all.

**It is ORANGE, not purple.** Settled by looking at the finished arrows
(2026-10-06). The key had been written from a shop stock photo, corrected to
purple on hearsay, and is now corrected to orange from the real thing.

**Yellow became SNAG**, chosen by Aaron rather than left spare — a pulled
thread is the most common flaw none of the other six cover.

## Hand-made arrows with the word on them (made 2026-10-06)
The magnetic arrows are being replaced by larger hand-painted cardboard ones
with a thick white border and **the word printed on the arrow**. Reading a
printed word is the most reliable thing a vision model does — far more
reliable than judging a colour — so the word becomes the primary signal and
the colour the fallback when it is blurred or cropped. That removes every
colour-matching failure at once: black on navy, red on red, lime against
yellow, and outlines colliding with the black and white meanings.

**The words, kept short because the longest one sets the text size:**

| Arrow | Word | Prints as |
|---|---|---|
| Red | HOLE | hole / tear / rip |
| Orange | STAIN | stain / discoloration |
| Blue | WEAR | pilling / fabric wear |
| Green | FADE | fading |
| Yellow | SNAG | snag / pulled thread |
| Black | ZIP | the zip, broken or missing |
| Black | BUTTON | the button, broken or missing |
| White | SEE NOTE | *nothing — the seller writes it* |

**White says SEE NOTE, not DESCRIBE** (Aaron's calls 2026-10-06). The arrows
appear in buyer-facing photos, and DESCRIBE read as an instruction written for
the app. SEE NOTE tells the buyer where to look instead.

**It is stacked on two lines — SEE above NOTE.** On one line those eight
characters print at a 0.27" cap, half the size of every other arrow and about
11px in the AI's copy. Stacked, each line is four characters and prints at
0.51" — the same as HOLE. The message costs nothing as long as it is not on
one line.

**Black is two arrows, ZIP and BUTTON**, rather than one generic hardware one.
That is more useful to a buyer, and those are the two hardware faults that
actually turn up. **Consequence: merging keys on the WORD, not the colour.**
Two BUTTON arrows become one line; a ZIP and a BUTTON stay separate even
though both are black.

**The yellow arrow is deliberately unassigned** (2026-10-06). The candidates
are SNAG (a pulled thread — the most common flaw none of the six cover), SEAM
(a split seam, which a buyer reads differently from a hole, since a seam can
be sewn) and PRINT (cracked graphics, only worth it if they list many printed
tees). Rather than guess, **use the SEE NOTE arrow for a few weeks and see
what keeps getting typed by hand** — that is what the catch-all is for, and
the data decides the colour instead of us. Note that yellow is the weakest
colour against cream, beige and light grey, so whatever it ends up meaning
should ideally be a flaw that appears on darker garments.

**Sizing, from what the AI is actually sent.** The analysis photo is 600px on
its long edge. What matters is not the arrow's size in inches but **how much
of the frame it fills** — at the framing used for flaw close-ups (arrow about
a third of the width), a 5" arrow with these short words puts the cap height
around 14px, which reads. The same arrow with a long word like DESCRIBE drops
to 11px, and at 3.5" it falls to single figures. That is why the words are
short: **the longest word sets the size for the whole set.**

Finish: satin paint — enough sheen not to look chalky, not enough to throw a
highlight across a letter.

- **Black gets the rarest type on purpose.** It is the hardest colour to see,
  and black clothing is common. Missing hardware is rare, so the risk is low.
- **Black was missed on the first real test** (2026-10-05). The arrow was
  pointing at a zip pull and lying along the navy drawcords of a dark flannel
  — same darkness, same thickness, same tapered shape. It read as a third
  drawstring. The prompt now tells the model to look twice for it, but this is
  a contrast problem, not a prompt problem: **lay a black arrow against lighter
  fabric** where it can't be mistaken for a cord. Rule of thumb — if you would
  struggle to spot the arrow in the photo yourself, so will the AI.
- **White is a flaw, not just a flag** (Aaron, 2026-09-29). It means something
  IS wrong. Used when the AI would struggle, or when the wording has to be
  exact.
- Red, orange, blue and green read clearly against almost anything and should
  carry the everyday work.

## What the arrows actually do, measured (2026-10-05)
Eight drafts of one L.L.Bean flannel, one arrow colour at a time, then four
of them re-run after the wording fix.

| Arrow | Result |
|---|---|
| Red | ✅ "Tear at the left pocket and hem." |
| Red ×2 | ✅ merged into one line naming both places |
| Green | ✅ "Fading at the top of the hood." — **lime reads as green, not yellow** |
| Blue | ✅ pilling |
| White | ✅ no description, and a note telling the seller to write it |
| Black | ❌ **missed, twice** |
| No arrows | ✅ empty list |
| Orange | **never tested as a colour — the words replaced it** |

**Green was the one expected to fail** and it is reliable. **Black is the one
that fails.**

**The colour-only system was never fully proven** — orange never once reached
the code under its old name, and the words replaced it before it could be.
That is fine: the words are the signal now, and the colour is only a fallback.

**Still to test:** the whole word system on a garment. Every result above was
from the colour-only version, which the words have now replaced. Black failing
twice is the result that still matters — the word on a black arrow should
rescue it, and that is the single most valuable test left.

## The field — 8b, BUILT 2026-10-02
Top level of the vision reply, beside `notes_for_seller`:

```json
"flaws": [
  { "color": "red",   "photo": 3, "where": "left cuff and right elbow",
    "text": "Holes at the left cuff and right elbow" },
  { "color": "white", "photo": 5, "where": "front panel below the chest",
    "text": null }
]
```

- **The AI writes the sentence, not a template** (users' call 2026-10-02:
  *"I dont think we need a template. there would be many different templates
  we would have to do?"* — one per colour, then again for merged vs single,
  then plurals). Unlike the measurements, nothing parses this text: it is read
  by a buyer, so variation is cosmetic rather than dangerous. **The colour
  still dictates the kind** — a red arrow is a hole even if the model would
  have called it a stain.
- **The AI merges same-coloured arrows itself**, since there is no template to
  join them with. One entry per LINE, not per arrow.
- **No size judgment at all** (users' call 2026-10-02). An arrow proves a flaw
  is there, not how big it is — a small snag on dark cloth may be invisible to
  the camera, and that is exactly when a required size field gets invented.
  Both directions cost money: a snag called large loses the sale, a hole
  called small gets a return. The arrows are one fixed size and could have
  served as a ruler; the users chose to leave size out, because the condition
  boilerplate already tells buyers to look at the photos.
- `where` is short free text — *"left cuff"*, *"right front thigh"*. Right
  area, not precise. A fixed vocabulary was considered and judged likely to
  fit badly as often as it helps.

**Code:** `cleanFlaws` (`listingPipeline.js`) drops any colour outside the six
and forces white back to `text: null` however chatty the model got — a model's
guess must never reach a buyer. `flawSeed`, `isFlawTodo` and `hasUnwrittenFlaw`
(`descriptionTemplate.js`) turn the entries into the lines the Flaws box
starts with, and answer the question the post block asks.

## It invented flaws on the first real garment — fixed 2026-10-05
An L.L.Bean flannel hooded jacket, no arrows on it anywhere, came back with
**two blue flaws** citing "AI photo 1" — the plain front shot. All five AI
photos were checked by hand: front, brand label, size tag, material tag, care
tag. **Not one arrow.** It also broke the merge rule (two blue entries instead
of one) and put *"Check hood edge and cuffs closely for fabric wear"* in the
AI Note, which rule 1 forbids outright.

**Cause: the prompt contradicted itself**, and the contradiction was older
than the flaws system. Three places told it to hunt for flaws:

1. `"condition_description": "...describe the condition in detail including
   any flaws."` — in the schema, far ABOVE the flaws rules. **And the app
   throws that field away** (`applyDescriptionTemplate` always overwrites it
   with the boilerplate), so it was costing tokens, producing nothing, and
   breaking the flaws system.
2. `notes_for_seller` listed *"a possible flaw you are not sure about"* as a
   good reason for a note.
3. The FLAWS rules sat near the END of a long rules list.

It obeyed the earlier instructions, found real wear on a used flannel, and
expressed it through the new field — treating the colour key as a vocabulary
("that's pilling, pilling is blue") rather than as something to look for.

**The fix:** `condition_description` removed from the schema entirely, the
flaw reason removed from `notes_for_seller`, and the FLAWS rules moved to
**first** in the rules list with the point made plainly — *you are not the one
who decides whether this garment has a flaw; the seller decides, by laying an
arrow on it.* An empty array is stated as the correct answer **even when the
garment plainly shows wear**.

**Verified on the same five photos:** `flaws: []`, `notes_for_seller: []`, no
flaw talk anywhere, measurements still read correctly (chest 42, length 24).

**What this says about the 2026-10-04 test.** That run returned `[]` and was
recorded as "rule 1 holds on a real call". Those photos had nothing obviously
wrong with them, so an empty array proved almost nothing. **A negative test
needs a garment with real, visible, unmarked wear** — that is the only version
of it worth running.

## What the AI does
- Reads **colour and position only.** Never judges severity, never describes a
  flaw that has no arrow.
- A white arrow is **never described.** It produces a placeholder line holding
  that flaw's place in the list, plus a check-this note through the existing
  [[AI Notes Plan|AI Note]] system: *"White arrow in photo 3, lower left front.
  Needs your description."*
- Needs a named `flaws` field in the prompt — this is
  [[Future Features|8b]]. Today the AI scatters flaw text under ad-hoc keys
  (`fading`, `condition_details`) and nothing reads it back.

## No Flaws box — it goes straight into the description (users' call 2026-10-02)
A separate Flaws box was designed and then dropped: *"I dont want a box, I
just want it in the description, it just needs to fill out the description and
we look at that."* The description field is already on the page and already
editable, so the flaws are written into it and the seller reads and corrects
them there. Whatever is in the description at List time is what prints —
nothing reaches a buyer that hasn't been looked at.

That removes the box, the seeding step and a stored field, and leaves the
block reading the description instead.

**One consequence:** re-analysing a draft rebuilds the description from
scratch, so a white-arrow flaw worded by hand is lost and the placeholder
comes back. Re-analysis already replaces the title and the specifics; there is
simply more to lose now.

```
Small hole on the left cuff
⚠ White arrow, front panel below the chest — describe this one
```
becomes
```
Small hole on the left cuff
Quarter-sized burn mark on the front below the chest
```
and prints
```
Condition — Pre-owned, good
Flaws:
• Small hole on the left cuff
• Quarter-sized burn mark on the front below the chest
Pictures included in the photos.
```

A white arrow means the box **cannot come back `None`** — the placeholder
takes that slot from the moment it is analysed.

## The block
**A draft cannot post while a ⚠ placeholder is still in the box.** Three ways
to clear it, all deliberate:
- Type the real description.
- Type `None` — you looked, it isn't worth calling a flaw.
- Delete the line — same outcome.

Typing `None` and leaving it empty already behave identically in
`flawLines` (`descriptionTemplate.js`): both print `Flaws: None` and both
suppress the "Pictures included" line, since there is nothing to point at.

**Why block:** an unfilled placeholder posted as-is reads to the buyer as the
flaw description. Same shape as the SKU rule — refuse the write rather than
send something wrong. **Why allow deleting:** a block you cannot clear on
purpose is one people learn to resent (Aaron's call 2026-09-29: *"If we dont
want to describe anything for any reason I dont want to be blocked"*).

## Same colour twice: merge it (Aaron's call 2026-09-29)
Two arrows of one colour are nearly always the same damage in two nearby
spots, and two bullets saying almost the same thing read worse than one.
**One line per colour, positions joined:**

```
Flaws: Small holes on the left cuff and right elbow
```
```
Flaws:
• Stains on the collar and left hem
• Pilling under both arms
```

**White never merges.** Two white arrows are two things the seller chose to
word personally; fusing them into one placeholder would lose a flaw. Each
white gets its own ⚠ line.

## Decided, not to be re-litigated
- **Arrow photos go to buyers**, like any other listing photo. The arrow points
  at something real either way, and it shows nothing is being hidden.
- **An arrow photo must ALSO be in the AI Analysis Photos.** The AI only ever
  sees that set — a photo that is only in the eBay listing photos is invisible
  to it, so the flaw will never be reported. Aaron confirmed 2026-10-05 that
  arrow shots go in both from now on.
- **No warning** when a line is deleted while an arrow is still visible in the
  photos. It is a judgment call made with the item in hand, and the app
  nagging would get old fast. (Noted consequence: `Flaws: None` can print with
  an arrow visible. The seller pulls the photo or leaves a line in.)
- **No "elastic" wording** anywhere yet — unrelated but same release, see
  [[Description Plan]].

## Open questions
1. **White-on-white.** A white arrow on a cream garment may not be seen — the
   exact case where missing it costs a return. Proposed safety net: a **"white
   arrow used"** toggle on the camera review screen, one tap, only when one is
   used. If the AI misses the arrow, the toggle still forces the note and the
   placeholder. Not yet agreed.
2. **Colour accuracy under real lighting.** Lime vs green vs yellow, and any
   arrow against a same-coloured garment. Untested.
**Settled 2026-09-29, no longer open:**
- **How position is worded** — handled by the named `flaws` field (8b), which
  ships in this same release. The field spec sets the position format, the
  same way 8a fixes the shape of measurements.
- **"Picture included" going singular** on a merged line covering two arrows —
  Aaron: not worried about it. Leave as is.

## Build order
1. [[Future Features|8a]] — named measurement numbers (prerequisite for the
   description).
2. Named `flaws` field in the prompt (8b) + the colour key in the prompt.
3. The Flaws box on the draft, seeded and editable.
4. The post block on ⚠ lines.
5. Wire `applyDescriptionTemplate` to route tops and bottoms to the new
   templates and pass the box through.
