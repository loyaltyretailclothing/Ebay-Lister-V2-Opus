# Seasonal Hold Plan

**Status: LIVE 2026-09-22.** `CRON_SECRET` set in Vercel by the users; both cron jobs confirmed listed in Vercel. First real posting morning ran 2026-09-27 and **failed on its one item** — see below; nothing was posted broken and the item came back to the queue. Second test scheduled for the morning of 2026-09-28.

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

## The first real posting morning — 2026-09-27 (failed, then made readable)
One item was due (Johnnie-O Brevard Henley, SKU C2421, $27.97, 13 photos). The run fired at **12:27 UTC = 7:27am Central** (Vercel's free plan can drift a cron by up to an hour) and the item **failed**: `Couldn't post automatically — [object Object]`.

**What was and wasn't damaged:** nothing reached eBay — no inventory item and no offer for C2421, no Listed record, no half-made listing, the SKU still clean. The draft went back to the queue marked Error with its hold cleared. The safety half of the design worked.

**What `[object Object]` meant:** the run did `new Error(data.error)`, and `data.error` was an **object**, not a sentence. Every error `/api/ebay/list` returns is a written sentence (checked all of them, and every throw in `src/lib/ebay.js`), so the reply wasn't ours — `{"error":{"code":…}}` is the shape **Vercel** returns when a function is cut off or never reached. Reproduced exactly: `String({error:{code:"FUNCTION_INVOCATION_TIMEOUT"}}.error)` → `[object Object]`.

**Two changes so the next one is diagnosable (2026-09-27):**
1. `src/lib/publishError.js` — `readReply` (reads the body as text, so an error page doesn't become a parse error) and `describeFailure` (our own sentence when there is one; otherwise `HTTP 504 — FUNCTION_INVOCATION_TIMEOUT`, or an error page reduced to its words). Used by **both** the hold run and List on eBay by hand, which had the same blind spot. Verified in the browser: the top bar showed `Failed: HTTP 504 — FUNCTION_INVOCATION_TIMEOUT` against a mocked reply, with nothing sent to eBay.
2. `/api/ebay/list` now declares `maxDuration = 60`, like the hold run already did. It had none, so it took the platform's short default (~10-15 s) while doing 13 photo uploads plus three eBay calls. A timeout is the leading suspect but **not proven** — the EPS uploads run in parallel, and the run recorded no status or body. Vercel's runtime log for that invocation is the only place the real cause is written down.

## Fallback if the crons ever stop running
Post the day's held drafts when the app is first opened that morning (the users are in it daily). Not needed as of 2026-09-22. See [[Home]], [[Draft Queue Plan]], [[Drafts and Camera Flow]], [[Future Features]].

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

## Photos of held drafts (added 2026-09-25)
- A held draft's photos are **marked** (`heldDraft` context on the photo in Cloudinary) and **leave the Photo Library**, so the library only holds what still needs reviewing.
- **Opening that held draft turns the library panel into just its photos** — open the Wowie shorts and only the Wowie shorts photos are there, with a line saying why. Create Listing is otherwise unchanged: normal drafts still see the whole library.
- The mark clears (photos rejoin the library) when the item is **unheld**, when the auto-post **fails**, or when the draft is **deleted**. When it **posts**, the photos are deleted instead — see below.
- **Delete Draft** now asks: a checkbox **"Also delete this draft's N photos"** (off by default), then **No / Yes, delete**. Ticking it deletes the photos from Cloudinary with the draft — the way to clear out photos for an item that's no longer being listed. Works the same for held and ordinary drafts.
- If a held draft's photos are missing when its morning comes, it doesn't post: it returns to the queue with the reason (same path as any other failure).

### Fixed 2026-09-27 — opening a held draft still showed the whole library
Two real faults, both now fixed:
1. **The photos couldn't be found.** The library loads the newest 500 photos; the held draft's photos were from days earlier, so filtering the loaded page never reached them (the account has 5,340 photos). `/api/cloudinary/list` now takes `heldFor=<draftId>` and asks Cloudinary for **exactly that draft's photos** (`context.heldDraft="…"`), however old they are.
2. **A slow answer overwrote the right one.** The library fetch starts as the page opens and takes a second or two; the held-draft fetch starts later (once the draft has loaded) and finishes first, so the library answer landed last and replaced it. `usePhotoLibrary` now numbers its requests and only the newest one is allowed to set the photos.

A draft held **before** the photo-marking existed has no marked photos; the panel falls back to the ordinary library rather than showing nothing. Re-opening **Hold** on it marks its photos.

## Photos are deleted half an hour after a held item posts (2026-09-27)
Users' call: once a held item is live on eBay its photos aren't needed — eBay keeps its own copies (EPS) and the [[Listed Report Plan]] thumbnail points at eBay's image, so nothing in the app breaks. They are **not** dumped back into the Photo Library (that would put finished items back in the review pile).

- **Posted** (the 7am run, or List on eBay by hand on a held draft): the draft goes, the photos stay hidden, and a small record says "these photos, deletable from 7:30". Half an hour later they're deleted from Cloudinary for good.
- **Failed**: unchanged — the draft returns to the drafts queue with the reason, and now its photos **go back into the Photo Library** with it, so it can actually be reviewed. (Before this they stayed hidden — a bug.)
- **Listed straight away**: unchanged. Those photos stay in the library as always.

### Why it isn't a timer
Nothing on the server can count down half an hour: a request answers and the function ends, and the free Vercel plan allows two cron wake-ups a day (both already used by the posting run). So posting only writes down **when** the photos become deletable, and a **sweep** does the deleting. It is called by whichever comes first:
1. **An open browser tab** (`PhotoSweeper`, mounted in the root layout). It asks the server what's due, is told when the next lot comes due, and sets a timer for that minute. Open the app at 7:05 after a 7:00 run and it deletes them at 7:30 while you're sitting there. A 15-minute heartbeat covers a tab that's been open since yesterday; a background tab still counts.
2. **Listing anything by hand** — the tab is open, so its timer is running anyway.
3. **The daily cron wake-up**, at the top of every run including the one that doesn't post — the backstop for nobody opening the app for days.

So half an hour is a **floor, never a deadline**: never sooner, occasionally later. The photos are out of the library the whole time either way.

### How it's built
- `src/lib/photoSweep.js` — `schedulePhotoDelete` (one raw record per draft in `ebay-listings/logs/photo-sweep`, due time in its context so a sweep can see what's due without downloading anything), `splitDue`, `sweepPhotos`.
- `POST /api/cloudinary/sweep` → deletes what's due, returns `{deleted, records, nextDueAt}`. POST so local test mode blocks it.
- `deleteDraft(id, { photosAfter })` schedules instead of releasing; the cron and `DELETE /api/drafts/[id]?posted=1` (hand-listed held drafts only) pass it.
- **Guard rails:** only ids under `ebay-listings/` are ever scheduled or deleted, at most 100 records a sweep, and a record whose body can't be read is left alone rather than guessed at. Tested against the real module with a stubbed Cloudinary (14 checks, nothing written to the account).

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
