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
| Row | Meaning |
|---|---|
| `◌ Phase 1 · 14 min` | photos still in the queue; the draft can't be opened yet. **Analyze now** pulls it out |
| `● Ready by Batch` + `Phase 2 · 3 min` | workable now; eBay's questions still queued. **Finish now** (phone) fills them live |
| `● Ready by Batch` | came back from the queue, complete |
| `● Ready by Force` | **the queue let it down and the app re-ran it live at full price.** A warning light, not a receipt — you'd otherwise never know |
| `● Ready` | you asked for it (Analyze Photos, or Analyze now). You already know, so it says nothing |

Aaron's wording, 2026-09-28: "by Force" is the app stepping in, *not* the user clicking Analyze.

## How it works
- **Submitting:** the camera sends `queued: true`; `/api/drafts/process` saves the draft with `status: "queued"`, `batch: { id, phase, at }` and its camera timing, then returns. Create Listing's **Analyze Photos** is unchanged and always instant.
- **One batch per draft**, not one batch per pile — cancelling works on a batch, so a shared one would mean pulling out twenty drafts to rescue one.
- **Collecting:** Anthropic never calls back. `POST /api/batches/collect` advances every queued draft; it's called by any open tab (`BatchCollector`, every minute while anything is queued, every 5 minutes otherwise) and by the morning cron. Results wait **29 days** at Anthropic, so nothing is lost if nobody opens the app.
- **Everything lives on the draft** in Cloudinary — a queued draft survives a closed laptop, a redeploy, or a week away.
- **Giving up:** a batch that fails, expires, or sits more than **20 hours** (before Anthropic's own 24-hour expiry) is run live automatically and marked `force`.
- **Analyze now / Finish now** (`forceLive`): cancels the queue place and runs it live. On **phase 2 it only fills the specifics** — the photos were already read and the draft may have been edited since, so re-running everything would throw those edits away.
- **Cost:** each phase writes an `ai` entry at **half price** with `batch: true` and the `waitMs` it waited. The tracker shows `N batched, saved $X · queue waits: median 22m, longest 4h 10m`.

## Code
`src/lib/batchAnalyze.js` (submit / check / cancel), `src/lib/batchCollect.js` (the state machine and the live fallback), `src/lib/runAnalysis.js` (one copy of the full live analysis, shared by the camera route, Analyze now and the fallback), `src/app/api/batches/collect/route.js`, `src/components/photos/BatchCollector.js`. The prompts stay in `listingPipeline.js`, split into `visionRequest`/`readVisionReply` and `specificsRequest`/`readSpecificsReply` so the live and queued paths send byte-identical requests.

## Tested locally 2026-09-28 — nothing queued for real
22 checks on the state machine with Anthropic, eBay and Cloudinary stubbed: phase 1 → usable draft + phase 2 queued; phase 2 → specifics land; waiting left alone; expired → run live and marked `force`; stuck over 20 hours → run live; **Analyze now** stays plain `Ready`; **Finish now** fills only the specifics and keeps edits made since; no category → still a usable draft with nothing further queued. Cost recorded at exactly half. In the browser, all five row states render on phone and desktop, and only phase 1 is locked.

## Known gaps
- **No "Finish now" on the desktop drafts panel.** A phase-2 row is itself a button (it opens the draft), and a button can't contain another button. The phone has it, which covers the camera flow. Better home: a line inside the open draft next to Item Specifics.
- **Nothing has been through the real queue yet** — the wait times are the whole point and are unknown until it runs. The tracker will answer it within a week.
- If the real median wait turns out to be hours rather than minutes, the fix already scoped is Aaron's one-tap category at review, which collapses the whole thing to a single call and a single trip. See [[AI Pipeline]].
