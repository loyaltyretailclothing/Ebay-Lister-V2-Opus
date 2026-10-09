# Batch Analysis Plan

**Status: BUILT 2026-09-28, tested locally (nothing queued for real), NOT pushed.** See [[Costs]], [[AI Pipeline]], [[Efficiency Tracker Plan]], [[Drafts and Camera Flow]].

## The deal
Anthropic runs a **batch queue**: the same requests, answered later, for **half the price**. Most batches finish inside an hour; the only guarantee is 24 hours. The discount *is* the waiting — batch work is fitted around the customers paying full price for an instant answer.

Aaron's call 2026-09-28: worth it regardless of the exact baseline. "We know it will save 50%, that is worth it to me."

## Why two phases
eBay sits in the middle of the pipeline, not Claude:

> photos → **Claude**: what is this? → **eBay**: what questions does that category ask? → **Claude**: answer them

Claude can't fetch eBay's question list halfway through an answer, and can't answer from memory — every category has its own set with its own allowed values, and eBay rejects anything that isn't legal for that exact category. So a queued draft makes **two trips**.

Sending several categories' question lists so Claude could pick was measured and rejected: the top eight categories are ~96,000 characters, about **28,000 tokens — nearly double what an analysis costs today.**

**The two trips don't compound in practice, because the draft doesn't wait for the second one.** Everything that makes a draft workable — title, category, description, keywords — comes out of phase 1, so the draft goes **Ready** then, and the specifics fill in behind it.

## What you see
**The drafts list has no buttons** — Aaron's call 2026-09-28, so a stray tap can't spend money. Pulling a draft out of the queue happens **inside the draft**, in the status lane, on both phone and desktop:

> ◌ Photos are in Anthropic's queue · 14 min. It's half price, and usually back within the hour. **[Analyze now]**
> ◌ Item specifics are still in Anthropic's queue · 3 min. Everything else is here. **[Finish now]**

A queued draft opens like any other (a phase-1 one is just empty apart from its photos). Because of that, an ordinary **Update Draft** must not quietly drop it from the queue — `POST /api/drafts` carries the existing `batch`, `timing` and `readyBy` over when the caller doesn't send them.

| Row | Meaning |
|---|---|
| `◌ Phase 1 · 14 min` | photos still in the queue; the draft opens but is empty |
| `◌ Phase 2 · 3 min` | workable now; eBay's questions still queued |
| `● Ready by Batch` | came back from the queue, complete |
| `● Ready by Force` | **Anthropic gave up on it (expired at 24 hours, or errored) and the app analyzed it live at full price**, so there's something to review. A warning light, not a receipt — you'd otherwise never know |
| `● Ready` | you asked for it (Analyze Photos, or Analyze now). You already know, so it says nothing |

Aaron's wording, 2026-09-28: "by Force" is the app stepping in, *not* the user clicking Analyze.

## How it works
- **Submitting:** the camera sends `queued: true`; `/api/drafts/process` saves the draft with `status: "queued"`, `batch: { id, phase, at }` and its camera timing, then returns. Create Listing's **Analyze Photos** is unchanged and always instant.
- **One batch per draft**, not one batch per pile — cancelling works on a batch, so a shared one would mean pulling out twenty drafts to rescue one.
- **Collecting:** Anthropic never calls back. `POST /api/batches/collect` advances every queued draft; it's called by any open tab (`BatchCollector`, every minute while anything is queued, every 5 minutes otherwise) and by the morning cron. Results wait **29 days** at Anthropic, so nothing is lost if nobody opens the app.
- **Everything lives on the draft** in Cloudinary — a queued draft survives a closed laptop, a redeploy, or a week away.
- **No deadline of our own.** However long the queue takes, the row goes on saying which phase it's in — users' call 2026-09-28 ("if it doesn't go overnight it just needs to continue saying what phase it's in"). Only when **Anthropic** gives up — it expires a batch at 24 hours — or the batch errors does the app step in, analyze it live so there's something to review, and mark it `force`. An earlier 20-hour timeout of mine was removed: it invented a deadline nobody asked for and produced a `force` the users hadn't chosen.
- **Analyze now / Finish now** (`forceLive`): cancels the queue place and runs it live. On **phase 2 it only fills the specifics** — the photos were already read and the draft may have been edited since, so re-running everything would throw those edits away.
- **Cost and waits:** each phase writes its **own** `ai` entry at half price, carrying `batch: true`, its `waitMs` and its `phase`. The phase is part of the entry's id (`ai_camera1_<draftId>` / `ai_camera2_<draftId>`) — without it phase 2 landed on top of phase 1 and **half of every batched draft's cost vanished** (found 2026-09-28 when Aaron asked whether the wait was one phase or both).
- Each trip is timed on its own and named the way the rows name them:

  > 272 batched, saved $2.03 · queue: **phase 1 34m**, **phase 2 13m** (longest 3h 41m)

  Phase 1 is the wait before the draft is workable — the one that matters day to day. Phase 2 is the wait for eBay's questions after that, which happens behind you. The longest is any single wait: what you're risking, not what to expect.

## Code
`src/lib/batchAnalyze.js` (submit / check / cancel), `src/lib/batchCollect.js` (the state machine and the live fallback), `src/lib/runAnalysis.js` (one copy of the full live analysis, shared by the camera route, Analyze now and the fallback), `src/app/api/batches/collect/route.js`, `src/components/photos/BatchCollector.js`. The prompts stay in `listingPipeline.js`, split into `visionRequest`/`readVisionReply` and `specificsRequest`/`readSpecificsReply` so the live and queued paths send byte-identical requests.

## Tested locally 2026-09-28 — nothing queued for real
22 checks on the state machine with Anthropic, eBay and Cloudinary stubbed: phase 1 → usable draft + phase 2 queued; phase 2 → specifics land; waiting left alone; expired → run live and marked `force`; stuck over 20 hours → run live; **Analyze now** stays plain `Ready`; **Finish now** fills only the specifics and keeps edits made since; no category → still a usable draft with nothing further queued. Cost recorded at exactly half. In the browser, all five row states render on phone and desktop, and only phase 1 is locked.

## Send To Queue — the way back in (2026-10-02)
**What went wrong:** the Anthropic account ran out of funds and nine camera
drafts failed to submit. `submitOne` threw, and `/api/drafts/process` saved
each one as `error` with its photos, carrying Anthropic's own sentence:
*"Your credit balance is too low to access the Anthropic API."* Nothing was
charged and no batch exists.

**Why there was no way back:** "Analyze now" is not a retry — it **cancels a
place in the queue** and runs live. A draft that never got submitted has no
place to cancel, so the button never even appears for it. The only route on
was a fresh live analysis at full price.

**The fix:** `POST /api/drafts/requeue` ( `{ draftIds }` or `{ draftId }` )
reads the saved draft and submits the same `visionRequest` the camera would
have — nothing is re-shot or re-uploaded, and the AI photo picks and AI note
come with it. The draft flips to `queued`, phase 1, and its old error is
cleared. It refuses a draft that has a title (analyzed — re-queueing would
throw away typed work), one already waiting, and one with no photos. The
route answers per draft, so one failure doesn't hide the rest, and an
out-of-funds reply is turned into plain words rather than a wall of JSON.

**Where the button is:** top right of Create Listing, desktop only —
**Send To Queue · Analyze Photos · Update Draft**. It took the slot of a
second **List on eBay**, which was removed: the one at the bottom of the
details column is now the only way to list (users' call 2026-10-02).
Mobile was deliberately left alone.

**Not yet exercised for real.** Submitting costs money and the account was
empty, so the first live press is still to come.

## The queue ate Cloudinary's rate limit — 2026-10-09
**The drafts list and the photo library both stopped loading.** Not a code
fault: Cloudinary's Admin API allows **500 operations an hour** and they were
all gone. Everything returned 500 until the quota reset on the hour.

**Why.** `BatchCollector` polls every 60 seconds while anything is queued, and
every poll called `collectBatches`, which cost:

- `listDrafts()` — 1 admin operation
- **plus 1 per queued draft**, because `advance()` opened each one *purely to
  read its batch id* before asking Anthropic whether it was ready

So one queued draft in one tab was ~120 operations an hour, running whether
anyone was using the app or not. Each extra tab or device multiplied it —
a phone and a desktop each is 240, and four queued drafts across two tabs is
over the cap on its own. Photos were never the cause: an upload is not an
admin operation, and the library only reloads when it is opened.

It is recent because the batch queue is recent. Before Send To Queue, drafts
were analyzed live and nothing sat waiting.

**The fix, three parts:**

1. **Ask Anthropic first.** The batch id now rides along in the draft's
   Cloudinary context, so `listDrafts` already has it and a waiting draft is
   checked **without opening it**. Checking Anthropic costs nothing against
   this quota. Drafts queued before this change have no id on the row and
   fall back to the old path.
2. **`getDraft` takes an optional URL.** It used to spend an admin call asking
   where the file lives before downloading it; `listDrafts` already returns
   that URL on every row. Only pass one that was just listed — it carries the
   asset version, and a stale one would read an older copy.
3. **One tab polls, not all of them.** A timestamp in `localStorage` claims
   each round; the other tabs skip it. The busy beat also eased from 60
   seconds to 2 minutes.

**Effect:** one queued draft across two tabs went from roughly **240
operations an hour to about 30**, and that 30 no longer grows with the number
of tabs or queued drafts.

### The same logs leaked the Cloudinary secret
The Cloudinary SDK rejects with an object carrying the whole request,
**including `request_options.auth` — the API key and secret in plain text** —
and the routes logged that object. The secret was therefore written into
Vercel's runtime logs every time one of these calls failed.

`src/lib/logError.js` now reduces an SDK error to its message and HTTP code
before logging, and the five Cloudinary routes use it. **The exposed secret
should still be rotated** — redacting future logs does not unpublish the old
ones.

## Known gaps
- **Nothing has been through the real queue yet** — the wait times are the whole point and are unknown until it runs. The tracker will answer it within a week.
- If the real median wait turns out to be hours rather than minutes, the fix already scoped is Aaron's one-tap category at review, which collapses the whole thing to a single call and a single trip. See [[AI Pipeline]].
