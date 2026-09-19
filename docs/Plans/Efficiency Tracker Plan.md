# Efficiency Tracker Plan

**Status: LIVE 2026-09-19.** Tracking starts with the first camera session / listing after this date. Silent — no visible clock anywhere. See [[Home]], [[Drafts and Camera Flow]], [[Draft Queue Plan]].

## Goal
See how long each item really takes — shooting it, and finishing its draft — by item type, and whether we're getting faster. No extra tapping.

## Two separate trackers (changed 2026-09-19)
Camera time and draft time are **separate trackers with separate data points** (users' call), not one combined entry.

1. **Camera** (phone): camera opens → **Done** = *shooting*; Done → **Create Draft** = *review*. Camera time = shooting + review. Also photo count. **Logged when Create Draft is tapped** (dated by when the photos were taken) — doesn't wait for the item to be listed.
2. **Drafts** (Create Listing, phone or desktop): draft opened → **List on eBay** = *draft time*. Adds up across several sittings (saved on the draft with Save/Update Draft, remembered for the page visit). Also how many times Analyze ran. **Logged when listed** (dated by listing). Every listed item counts, however it was made.

A small combined line stays at the top of the report for now: "Typical per item: camera X + draft Y ≈ Z" (the two typical times added — not a separate tracker).

Not tracked for now: who did it (Shannon / Aaron).

## Item type — automatic
- Camera: the server adds the eBay category once the AI has picked it while processing the draft (the entry is first written without one, then updated in place). If processing fails it stays "Uncategorized".
- Drafts: the category the listing was posted in.

## Outliers — count active time only
- Any gap with no tap / typing / scrolling / mouse movement counts **at most 30 seconds** (capped, not dropped — lining up a shot or reading a tag still counts, walking away doesn't).
- **Pauses** when the app is in the background, the phone is locked, or the browser tab is hidden.
- Example: work 3 min, walk away 30 min, finish in 1 min → ~4½ min, not 34.
- The report uses the **median** (typical) time and lists entries **over 20 min active** separately as outliers (left out of the numbers).

## Where the log lives
Cloudinary, **one small raw file per event** under `ebay-listings/logs/efficiency/`, named `camera_<draftId>` or `draft_<listingId>`. Each event only ever writes its own file — two people working at once can't clobber each other, and a retried request just rewrites its own entry instead of counting twice. All fields are also in the file's context metadata so the report reads everything in one list call. Free, no new accounts, no AI cost.

## The report — desktop tab "Track" (page: Efficiency Tracker)
- **Date range** for the whole page: This week · Last week · This month · Last month · Last 30 days · All time · Custom. **Compare with** (previous period or another range) shows "was X, N% faster/slower" everywhere.
- **Camera section:** headline camera time per item; shooting and review; items shot and per active hour; graphs — camera time week by week (last 12 weeks), where the time goes (shooting vs review stacked), by category; category table; outliers.
- **Drafts section:** headline draft time per item; items listed and per active hour; outliers count; graphs — draft time week by week, by category; category table; outliers.
- Graphs are plain SVG; hover a point or bar for its numbers. Desktop only.

## How it's built
- `src/lib/activeClock.js` — the active-time clock.
- `src/app/camera/page.js` — times shooting/review, sends `timing` with Create Draft.
- `src/app/api/drafts/process/route.js` — writes the camera entry (before and after the AI picks the category). Camera timing is not stored on the draft.
- `src/hooks/useListingEditor.js` — draft time per listing (`listing.timing.finishMs`, `analyses` saved on the draft — never sent to eBay; the publish route only reads the fields it needs); on a successful List on eBay posts the draft entry to `POST /api/efficiency`. Best-effort: a failed log never blocks listing or drafts.
- `src/lib/efficiency.js` (entries, median, outliers, weeks start Monday), `src/lib/efficiencyLog.js` (Cloudinary), `src/app/api/efficiency/route.js`, `src/app/efficiency/page.js`.

## Test results (2026-09-19, all faked — nothing written)
- 60 s activity + 10 min away → ~1.5 min logged.
- Camera: 120 s shooting → 135 s (incl. real clicks); review with a 5-min walk-away capped at 30 s.
- Entries build and read back correctly; stable ids (camera entry updates in place when the category arrives).
- Report previewed with ~10 weeks of sample data for both trackers, compare mode included.
