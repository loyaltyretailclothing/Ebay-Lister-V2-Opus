# Costs

See [[AI Pipeline]], [[Overview]].

## Measured per analysis (Sonnet: $3 per million input tokens, $15 per million output)
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

## How to measure
Vercel dashboard → Logs:
- Filter `[COST] pass1-vision` → number of analyses
- Filter `[POST]` → number of listings posted
- Each `[COST]` line shows `est=$`. The Anthropic Console shows the exact daily total.
- Logs only keep a short window, so check the same day.

## Levers not pulled yet
- Cut Pass 2 value lists (200 → ~50). Risky, measure first. See [[Open Issues]] #6.
- Make Pass 3 optional.
- Prompt caching.

## Other services
- Cloudinary: free plan. See [[Photos and Cloudinary]].
- Google Geocoding: free allowance far exceeds our use.
- eBay APIs: free.
