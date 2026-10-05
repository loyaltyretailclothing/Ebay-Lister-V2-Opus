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

## The colours (Aaron's call 2026-09-29)
| Colour | Meaning |
|---|---|
| Red | Hole, tear or rip |
| Orange | Stain or discoloration |
| Blue | Pilling or fabric wear |
| Green | Fading |
| Black | Broken or missing hardware — button, zip, drawstring |
| **White** | **Hands off. A real flaw, but the seller writes the words.** |

- **Black gets the rarest type on purpose.** It is the hardest colour to see,
  and black clothing is common. Missing hardware is rare, so the risk is low.
- **White is a flaw, not just a flag** (Aaron, 2026-09-29). It means something
  IS wrong. Used when the AI would struggle, or when the wording has to be
  exact.
- Red, orange, blue and green read clearly against almost anything and should
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
