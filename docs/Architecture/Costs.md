# Costs

See [[AI Pipeline]], [[Overview]].

## Model: Claude Sonnet 5 (since 2026-09-18)
Switched from Sonnet 4.6 without a side-by-side test (users' call; switch back if quality drops — one line, `MODEL` in `src/lib/listingPipeline.js`, plus the two price constants).
- Price $2 / $10 per million tokens (4.6 was $3 / $15), but Sonnet 5 counts the same text as ~30% more tokens → expected ~13% cheaper per analysis, about $0.05–0.06.
- "Thinking" is turned off (Sonnet 5 thinks by default and bills it as output); works like 4.6 did.
- The `[COST]` log lines use Sonnet 5 prices. Re-measure the table below from the logs after a few days.

## Measured per analysis on Sonnet 4.6 ($3 per million input tokens, $15 per million output)
| Pass | Typical tokens (in / out) | Cost |
|---|---|---|
| Pass 1 vision | ~4,700 / 420 | ~$0.020 |
| Pass 3 refine (only when a style number is found) | ~2,500 / 270 | ~$0.012 |
| Pass 2 specifics | ~10,800–15,000 / 390 | ~$0.038–0.051 |
| **Total** | | **~$0.07–0.08** |

Measured 2026-06-06, before Pass 2's JSON was compacted the same day, so it should be a bit lower now.

SEO keywords (2026-09-16) add about +$0.003 per analysis on Pass 1. See [[Title Keywords Plan]].

## Why the dashboard shows ~$0.11 per listing
Cost is per **analysis**, not per posted listing. Publishing costs $0 in AI. Drafts that are abandoned or re-analyzed spread their cost over the listings that do post. Roughly 1.5 analyses per posted listing ≈ $0.11.

Claude Code development work is on a separate subscription and is **not** part of this bill.

## The app measures itself now (2026-09-28)
Every Anthropic reply already carries its own token counts — free, no extra call. The app read them, printed a `[COST]` line to the Vercel log, and threw them away. Those numbers are now **written down** and shown in the [[Efficiency Tracker Plan|Efficiency Tracker]], so cost per listing is measured rather than estimated:

> AI cost **$0.68** over **19** analyses · **3.4¢** per listing · *22% cheaper*

- One `kind: "ai"` entry per AI run in the efficiency log (`src/lib/costLog.js`, `buildAiEntry`): tokens in/out, the cost at the prices of the day, where it came from (camera / analyze / specifics / refine), and a `batch` flag that is always false for now.
- Written by all four routes that call Claude, including the **failure** path of the camera pipeline — a run that broke halfway was still charged, and hiding it would understate the month.
- Keyed `ai_<source>_<draftId>`, so the camera's retried request rewrites its own entry instead of counting twice, while a later manual re-analysis of the same draft is its own entry.
- **Per listing divides by items listed, not by analyses** — abandoned and re-analyzed drafts are a real cost of each listing that does go up.
- Never blocks anything: a failed write is logged and ignored.

This replaces the estimates below. Anything in this note from before 2026-09-28 was worked out by measuring prompt sizes and guessing at tokens-per-character; treat the tracker as the truth once a few days of entries exist, and cross-check the total against the Anthropic Console.

## How to measure
Vercel dashboard → Logs:
- Filter `[COST] pass1-vision` → number of analyses
- Filter `[POST]` → number of listings posted
- Each `[COST]` line shows `est=$`. The Anthropic Console shows the exact daily total.
- Logs only keep a short window, so check the same day.

## Levers not pulled yet
- Cut Pass 2 value lists (200 → ~50). Risky, measure first. See [[Open Issues]] #6.
- Make Pass 3 optional.
- ~~Prompt caching~~ — **declined 2026-09-28**, worth only a few dollars a month and only when back-to-back items share a category. See [[Future Features]] #7.

## Other services
- Cloudinary: free plan. See [[Photos and Cloudinary]].
- Google Geocoding: free allowance far exceeds our use.
- eBay APIs: free.
