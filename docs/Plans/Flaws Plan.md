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

## The colours (Aaron's call 2026-09-29; purple corrected 2026-10-05)
Each colour allows a **short list of words**, and the AI picks exactly **one**
of them — whichever matches what it can see.

| Colour | Pick one of | |
|---|---|---|
| Red | hole / tear / rip | |
| Purple | stain / discoloration | |
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
would have called every purple arrow a stain even when the mark was plainly
discoloration. **Picking one from a list is not the same as reciting the
list** — the first is accuracy, the second is hedging.

**It is purple, not orange** (2026-10-05). The shop's stock photo showed an
orange arrow and the key was written from it; the arrows that arrived are
purple. This matters: `cleanFlaws` drops any colour outside the six, so a
purple arrow against an "orange" key would have been thrown away silently.

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
- Red, purple, blue and green read clearly against almost anything and should
  carry the everyday work.

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
