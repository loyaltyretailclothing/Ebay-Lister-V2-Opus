# AI Notes Plan

**Status: BUILT 2026-09-18, tested locally, NOT live.** Real test: a clear NWT shirt got no notes; Greyson pants got "No measurements visible — confirm waist and inseam…". See [[AI Pipeline]], [[Decision Log]], [[Redesign Build Plan]].

## Goal
Let the AI leave a short "check this" message on a listing when it is genuinely unsure, so wrong sizes and missed flaws are caught before listing.

## The three note boxes (Create Listing: desktop photos column, phone Photos tab)
In this order:
1. **Draft Note** — the user's note to themselves (typed on the camera review screen or here). Unchanged, moved to the top. Never sent to the AI or eBay.
2. **AI Note (new meaning)** — the AI's message to the user. Written by the AI during analysis. **Read-only**, amber, with a **Clear** button. Hidden entirely when empty. Re-analyzing replaces it.
3. **AI Read** — what the user writes for the AI to read when generating a listing. This is the box that used to be called "AI Note" (renamed only; same stored field `aiNote`, existing drafts keep their text). The camera review button is renamed "AI Read" too.

## Hiding empty boxes
- An empty Draft Note / AI Read shrinks to a one-line header with a "＋"; click/tap to open and type. If left empty it shrinks back.
- A box with text is always open and cannot be collapsed.
- Draft Note and AI Read keep their red "has text" look; AI Note is amber so the AI's words look different.
- No label in the Drafts list (not needed).

## What the AI writes (Pass 1, no extra AI call)
- A new field in the analysis output: up to 3 short notes, **only when genuinely unsure**; none when confident.
- Examples: size tag not visible / size guessed; tag size vs measurements disagree; possible flaw (with photo number); brand or style is a best guess; no measurements visible.
- Worded as "check", not "fix". Stored on the listing (new field, e.g. `aiMessage`), so it survives saving and shows on camera drafts too.
- Cost: roughly +$0.001 per listing (a few extra output words).

## Not included
- Drafts-list badge (users: not needed).
- App-side rule checks (no SKU, no price…) — possible later.
