# Seasonal Hold Plan

**Status: BUILT 2026-09-21/22, tested locally (nothing posted, no drafts changed), NOT live.**

## How it's built
- `src/lib/seasons.js` — the four seasons, their dates (month is 1-12), what each covers, and `suggestSeason` (only outerwear/snow/swim/flannel words, and only when the date is 4+ weeks off).
- Hold is stored on the draft as `listing.holdUntil` (YYYY-MM-DD) + `listing.holdSeason`, and mirrored into the Cloudinary context (with `price` and `sku`) so the On Hold page totals up without downloading every draft (`src/lib/drafts.js`).
- `HoldDialog` (desktop: button next to List on eBay, bottom right; phone: under Skip Draft) → `useListingEditor.holdDraft` saves the finished draft with its date and moves to the next draft. A green "Held for Winter — posts itself on Sep 15, 2027" stays ~8 s (it outlives the draft switch).
- Held drafts are filtered out of the queue in `refreshDrafts` (`heldCount` kept for display).
- `/on-hold` (rail **Hold**): totals, a card per posting day, Open / Post next run / Unhold. `PATCH /api/drafts/[id]` now takes `{holdUntil, holdSeason}` as well as `{skipDraft}`.
- `/api/cron/post-held` + `vercel.json` crons at 12:00 and 13:00 UTC; posts only when it's 7–8 am America/Chicago. Batches of 20, chains into the next batch, 300/day backstop, `CRON_SECRET` (set in Vercel) required. Posts through the same `/api/ebay/list` path (so the SKU check applies), deletes the draft, logs an Efficiency Tracker draft entry, and writes a run summary (`src/lib/holdRuns.js`) shown on the On Hold page.
- Settings → **Seasons** (`/settings/seasons`) shows the dates, what each season covers, and the honest caveat about the research.

## Tested (2026-09-21/22)
- Season dates and suggestions checked in isolation: parka in June → Sep 15; parka on Sep 1 → no suggestion (season is here); swim trunks → Mar 1; jeans/polos → none.
- Hold dialog: blocks holding while title/category/price/SKU/photos are missing; with those filled it saved (faked) `holdUntil 2027-09-15`, `holdSeason Winter` and moved to the next draft.
- On Hold page previewed with sample held drafts: totals, per-day cards, last-run banner.
- The posting job ran locally with nothing due: posted 0, wrote no log. **Not yet tested end to end with a real held draft** — the first real posting morning is the proof.

## Before it goes live
- Add **`CRON_SECRET`** in Vercel (users' own value — Claude never handles secrets).
- Check the Vercel plan allows 2 daily cron jobs; if not, fall back to posting when the app is first opened that day. See [[Home]], [[Draft Queue Plan]], [[Drafts and Camera Flow]], [[Future Features]].

## Goal
Finish a draft completely while the item is in front of you, then have the app **post it by itself** when its season arrives. Out-of-season items stop clogging the draft queue, and nothing has to be re-opened later.

Not eBay's own scheduled listing: eBay won't hold a scheduled listing long enough (months). The app holds the draft and posts it on the day.

## Setting a hold (at review/finishing time)
- **Create Listing, desktop:** a **Hold until…** button in the empty space at the bottom right, beside List on eBay (users pointed at that spot). Phone: under Skip Draft and in the ••• menu.
- The panel offers four presets with their dates, plus **Custom date**:

| Preset | Date | Covers |
|---|---|---|
| Spring | Feb 15 | Light jackets, cardigans, transitional |
| Summer | Mar 1 | Shorts, swim, tanks, linen |
| Fall | Aug 15 | Flannels, light jackets, sweaters |
| Winter | Sep 15 | Heavy coats, parkas, wool, snow gear |

- Dates are editable in Settings; they roll to next year once passed. No back-to-school / Halloween / Christmas presets (users' call 2026-09-21).
- **No "post automatically" checkbox** — on hold means it posts on the day (users' call).
- The draft should be **complete** when held (photos, title, category, price, SKU, policies), because it posts as-is.

## While held
- Held drafts leave the normal queue — Next draft passes over them, like Skip Draft.
- **Its own desktop tab "On Hold"** so the Drafts panel stays simple (users' call). Shows:
  - Header totals: "312 items on hold · $9,840" (sum of asking prices — not net of offers/markdowns).
  - A card per release date: "Fall — Aug 15 · 142 items · $4,215 · in 47 days".
  - A table: photo, title, SKU, price, hold date, days to go. Open it, change the date, release now, or cancel the hold.
- Phone: reachable from the ••• menu.

## Posting morning
- Runs at **7:00 am Central** (users' time zone), handling daylight saving so it doesn't drift to 6 am in winter — two daily server wake-ups, posting only on the one that is 7 am local. If the hosting plan won't allow two scheduled jobs, fall back to posting when either user first opens the app that day.
- Posts everything due that day in **batches of 20**, then starts the next batch immediately and keeps going until the day is done (users: a cap must not stop the rest). Daily ceiling ~300 as a backstop.
- Before each post: the same **SKU check** as manual listing (never reuse a SKU ever used on eBay; failed lookup = stop that item).
- A draft can only post once, even if the job runs twice.
- **Anything not postable** (missing price/SKU, SKU check fails, eBay rejects) is **not** posted: it goes back to the top of the draft queue marked "Couldn't post automatically" with the reason. The rest of the batch continues.
- Opening the app afterwards shows "142 listings posted this morning · $4,215" plus anything that failed.
- [[Efficiency Tracker Plan]]: auto-posted items still log a draft entry (finishing time was already counted while the draft was finished), dated the day they post.

## Suggestions (users' call 2026-09-21: yes, "it would only help")
- When a draft's item type is clearly seasonal AND that season is months away, the Hold panel opens with that season pre-picked and says why (e.g. "Parkas sell Nov–Jan — hold until Sep 15?"). Only for the strong cases: heavy outerwear, snow gear, swimwear, wool/flannel. Ordinary shirts, jeans, polos and plain shorts get no suggestion (research: holding those may cost more than it gains).
- **What each season covers is written in the app**, not just in these notes: the Hold panel lists the item types under each preset, and Settings → Seasons shows the same list next to the editable dates.

## What the research said (2026-09-21)
- **eBay publishes no "list by" calendar for apparel.** Its seller guide only says to promote seasonal items "weeks in advance".
- Strong consumer data exists for shopping-start dates (NRF): back-to-school ~⅓ start by early June; Halloween 49% start by September; Christmas 52% by end of October. Apparel-season listing dates come from reseller blogs/forums — opinion, not data.
- **Counter-view worth remembering:** many high-volume sellers argue against holding at all (listing is cheap; a held item can't sell). The only numeric seller evidence found supports holding **heavy outerwear** (one seller: 27 coats sold Aug–April, zero May–July). Dated novelty (Halloween, ugly Christmas sweaters) has hard cliffs.
- No credible data on best day/time of day to list — ignore those blog claims.
- Spring is Easter-driven and Easter moves; may be worth an Easter-relative date later.
- Season **ends** matter too → season-end markdown idea recorded in [[Future Features]] #1 (leave the item listed, drop the price; "pull back to drafts" was dropped).
