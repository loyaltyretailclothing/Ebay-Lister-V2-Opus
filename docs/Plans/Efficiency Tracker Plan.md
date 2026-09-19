# Efficiency Tracker Plan

**Status: BUILT 2026-09-19, tested locally (faked clock / camera / listing — nothing written), NOT live.**

## How it's built
- `src/lib/activeClock.js` — the active-time clock (30 s idle cap, pauses when hidden).
- Camera (`src/app/camera/page.js`) times shooting/review and sends `timing` with the draft; `api/drafts/process` stores it on the draft as `listing.timing` (never reaches eBay — the publish route only reads the fields it needs).
- Create Listing (`useListingEditor`) times finishing per draft; saved on the draft with Save/Update Draft (`listing.timing.finishMs`), remembered across drafts for the page visit; counts Analyze runs.
- On a successful List on eBay: one entry → `POST /api/efficiency` → `src/lib/efficiencyLog.js` writes one raw file `ebay-listings/logs/efficiency/eff_<ms>_<rand>` (fields also in context metadata; `overwrite: false`). Best-effort: a failed log never blocks listing.
- Report: `/efficiency` (rail **Track**), math in `src/lib/efficiency.js` (median, 20-min outlier flag, weeks start Monday). Graphs are plain SVG, hover for numbers.
- Test results: 60 s activity + 10 min away → logged ~1.5 min; camera 120 s shooting → 135 s (incl. real clicks); review with a 5-min walk-away capped at 30 s. See [[Home]], [[Drafts and Camera Flow]], [[Draft Queue Plan]].

## Goal
See how long each item really takes — shooting it and finishing its draft — by item type, and whether we're getting faster. No extra tapping.

## What gets timed
1. **Camera** (phone): camera opens → **Done** = *shooting time*; Done → **Create Draft** = *review time*. Also photo count.
2. **Draft finishing** (Create Listing, phone or desktop): draft opened → **List on eBay** = *finishing time*. Adds up across several sittings if the draft is opened, left and reopened. Also whether Analyze was re-run.

Not tracked for now: who did it (Shannon / Aaron).

**Total time per item is the headline number** (shooting + review + finishing, all active time). The three parts are shown alongside it as the breakdown.

## Item type — automatic
No category picking in the camera. The camera times ride along on the draft; when the draft is **listed**, one log entry is written with the eBay category the listing ended up in (e.g. Jackets, Shorts), plus camera time, review time, finishing time, photo count, date.

## Outliers — count active time only
- The clock counts **active time**: any gap with no tap / typing / scrolling / mouse movement counts **at most 30 seconds**. (Capped rather than dropped, so lining up the next shot or reading a tag for 20–30 s still counts, but walking away doesn't.)
- It **pauses** when the app is in the background, the phone is locked, or the browser tab is hidden.
- Example: work 3 min, walk away 30 min, finish in 1 min → logs ~4½ min, not 34.
- The report uses the **median** (typical) time, not the average, and **flags extreme entries** (e.g. over 20 min active) so they don't skew anything.

## Where the log lives
Cloudinary (same account as drafts/settings), **one small file per listed item** under `ebay-listings/logs/efficiency/`. Add-only — nothing is ever overwritten, so two people listing at once can't clobber each other (unlike the whole-file settings save that caused the category loss). Free, no new accounts.

## The report — new desktop tab "Efficiency Tracker"
- Rail label (small): **Track**; page title: **Efficiency Tracker**.
- **Total time per item** front and center: typical (median) overall, and **by category**, with count of items.
- Next to each total, the split: shooting · review · finishing.
- **Dates:** every entry stores when the item was shot and when it was listed. A **date range picker** (This week · Last week · This month · Last month · custom) filters the whole report.
- **Compare two periods** side by side — e.g. last month vs this week — with the change shown (e.g. total per item 5m 10s → 4m 20s, 16% faster), overall and by category.
- **By week** — trend over time; **items per hour** of active time.
- **Graphs:**
  1. **Total time per item, week by week** — a line (typical/median per week) so improvement is visible at a glance; hover a point for the week's numbers.
  2. **Where the time goes** — the same weeks as stacked bars split into shooting · review · finishing.
  3. **By category** — horizontal bars of total per item for each category (jackets vs shorts…), following the date range picked.
  Graphs follow the date range; in compare mode, both periods show in two colors.
- Flagged outliers listed separately.
- Read-only; phone doesn't get the tab (desktop only).

## Notes
- Items listed without going through the camera (library photos) log finishing time only.
- Drafts made before this feature have no camera time — they log finishing time only.
- Nothing here costs AI money.
