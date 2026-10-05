# Future Features

Ideas we want to come back to. Nothing here is built or agreed in detail yet. See [[Home]], [[Open Issues]], [[Decision Log]].

## 0. Learn from what you correct (users' pick 2026-09-28 — "a great idea and we need to save that")
**The idea:** every time the AI proposes a title, a keyword or an item specific and you change it before listing, that's a graded answer. You produce ~450 of them a month and the app throws every one away.

**What it does:** record the difference between what the AI proposed and what was actually listed. Once a week, one cheap pass over the last couple of hundred differences looks for patterns — *"you rewrite Slim Fit to Tailored Fit on every Bonobos"*, *"you delete Preppy from keywords 80% of the time"*, *"Size Type is wrong 30% of the time on Big & Tall"*. Those become house rules in the prompt.

**Why it's the big one:** it compounds. Every month it's more accurate on *your* inventory rather than clothing in general. And it's the only route to the biggest prize in the app — **selective review instead of checking everything**. Draft finishing is 3m 06s × 450 = **23 hours a month**; knowing which fields are reliable is what turns that into "three things need you" and gives a dozen hours back. Every other saving discussed is rounding error next to it.

**Cost:** capturing the differences costs nothing (a diff of two objects already in memory at List on eBay). Only the weekly pattern-read costs anything — pennies.

**Open questions:** telling "the AI was wrong" apart from "I changed my mind"; how many weeks before the patterns mean anything; whether the house rules go in the prompt or into a per-category memory.


## 1. Selling what's already listed: offers to watchers + automatic markdowns (top pick)
- **What:** on a schedule (e.g. every morning), the app checks active eBay listings and applies rules the users set once. No AI — just rules and arithmetic.
  - **Offers:** e.g. listed 14+ days with watchers, no offer sent in the last 7 days → send watchers 10% off (eBay's own "send offer to interested buyers").
  - **Markdowns:** e.g. 30 days → −5%, 60 days → another −5%, never below a floor.
  - **Season-end markdown (users' idea 2026-09-21):** leave the item listed (it's already up, keeps its watchers and search history) but drop the price as its season ends — and ONLY for items whose season is ending, e.g. parkas marked down in spring, not a summer shirt just because it's old. Needs the same season dates as [[Seasonal Hold Plan]]. Preferred over ending/relisting dead-season listings ("pull back to drafts"), which was considered and dropped.
- **How:** Vercel scheduled job → ask eBay for active listings (age, price, watchers) → apply rules → tell eBay to send offers / update prices.
- **Safety rails:** floor price, excluded items, a "show me first" mode that lists planned actions for approval, and a log of every offer/price change.
- **Check with eBay's live API before building:** which listings are eligible for offers, the smallest discount allowed, how often watchers can be offered, and whether markdowns should use eBay's own sale/markdown feature (crossed-out price).
- **Why:** works on the whole store at once; offers to watchers convert well. Earns more from inventory already listed.

## 2. Pre-post check (catch eBay rejections before they happen)
- Before List on eBay sends anything, check the listing against eBay's rules for its category: allowed conditions, missing required item specifics, size combinations that don't go together (e.g. Size Type for waist 33/35/37 — see [[Size Type and Size]]).
- Show exactly what to fix instead of a failed post. No AI; uses data the app already fetches.

## 3. Sourcing ↔ sales: see what's actually profitable
- Record cost per item or per trip; pull sold prices from eBay automatically.
- Profit per item, store and brand, and days to sell. Gives [[Sourcing]] real money numbers.
- Biggest effort: needs a way to tie each item to where it came from (SKU prefix per store, or a tap in the camera).

## 4. Shipping weight and box size filled in automatically (no AI)
- Save a typical weight and box size per item type once (e.g. tee 8 oz, jeans 1 lb 8 oz, hoodie 1 lb 12 oz).
- The app fills them in when the category is chosen, and you adjust when needed.
- **Why:** it's typed on every single listing. Small per item, but hundreds of times a month.

## 5. Old listing report — BUILT, PARKED
- Built and tested 2026-09-18, saved on git branch `old-listings` (not live). Everything about it — what it shows, where the data comes from, how to bring it back — is in [[Old Listings (Parked)]].
- Later on top of it: actions (offer to watchers, lower price, end, relist) and "normal days to sell" from sold orders.

## 6. "Next item" in the camera
- After shooting one item, tap **Next item** instead of Done → review → Create Draft: that item's photos become a draft in the background and the camera is ready for the next item.
- Shoot a whole cart without leaving the camera; set notes and AI picks later from Drafts.
- **Open questions:** which photos the AI reads when there's no review step (first few? all?), and where voice notes fit in.
- **Why:** fewer taps per item across a sourcing trip.

## 8. Named fields instead of free text, so every listing comes back the same shape (2026-09-29)
**8a is BUILT 2026-10-02**, sitting uncommitted for the
[[Release - Descriptions and Flaws|description release]]. 8b still to do.
**The problem:** the prompt asks for measurements as ONE free-text field —
`"measured_size": "Measured size if visible, otherwise null"`
([[AI Pipeline]], `listingPipeline.js`). No format is requested, so the AI
picks its own wording every listing: `32x30`, `Waist 30, Inseam 31`,
`Waist 30" Rise 11" Inseam 31"`. There is no chest, length, waist, rise or
inseam field at all — everything has to be dug back out of that one string.
Line 108 makes it worse by inviting `"...any other details you observe"`,
which is why flaws land under `fading` on one listing and `condition_details`
on the next.

**The fix — 8a, measurements as named numbers:**
```
"measurements": {
  "chest_in":  "Chest in inches, number only. null if not measured.",
  "length_in": "Length in inches, number only. null if not measured.",
  "waist_in":  "Waist in inches, number only. null if not measured.",
  "rise_in":   "Rise in inches, number only. null if not measured.",
  "inseam_in": "Inseam in inches, number only. null if not measured."
}
```
A number has no wording to vary. Keep `measured_size` as well — the
[[AI Pipeline|2-inch rule]] and every saved draft depend on it. Keep `rise`
as the Low/Mid/High guess too, because eBay wants it as an item specific;
`rise_in` is the tape measure, and only that one is ever printed.

**8b, a named field for anything the app reads.** Starting with flaws when the
flaws box is built. The open-ended "any other details" can stay for extras
nobody reads, but the app must never depend on it again.

**Note:** 8a is really a prerequisite for [[Description Plan]] going live, not
a someday item. The description digs measurements out of that free-text pile,
and if the AI phrases it a way the code doesn't recognise, a listing goes out
with no measurements at all.

**A `temperature: 0` change was paired with this and has been removed**
(2026-10-04): `claude-sonnet-5` rejects the parameter with a 400, so it would
have broken every AI call. The argument it was making — that named fields make
the AI consistent with *the app* while temperature would have made it
consistent with *itself* — no longer has a second half. Named fields are the
only one of the two that exists on this model. See
[[Release - Descriptions and Flaws]].

**Cost:** nothing worth counting, a handful of tokens on replies already paid for.

## 7. Prompt caching on the item specifics step (AI cost) — DECLINED 2026-09-28
**Aaron's call: "a couple bucks a month doesn't seem worth it."** Don't raise it again unless AI spend changes shape (many more listings, or a much dearer model). The reasoning below stands if it's ever revisited.

A question worth keeping, since it came up: caching doesn't mean the AI answers before it has looked. **Pass 2 never sees the photos** — Pass 1 looks and writes down `observations`, and Pass 2 fills the boxes from that summary, the title and the category list. And a model reads its whole prompt before writing anything, so moving a section earlier doesn't change what it can take into account; order only matters because a cache matches on the *prefix*.

- The item specifics step (Pass 2) is the expensive one (~$0.036 of ~$0.055 per analysis on Sonnet 5). ~90% of what it sends is eBay's specifics list for the category — identical for every item in that category.
- Move that list to the front of the request (instructions unchanged, only the order) and mark it reusable. Same category within 5 minutes → that step ~80% cheaper (~$0.006); otherwise ~20% more (~$0.043) for the first one.
- Estimated savings ~$0–7/month depending on how often back-to-back items share a category (break-even ~25%). No quality change.
- Plan: build it, add cache numbers to the `[COST]` log lines, check real reuse after a week, keep or turn off. Do it after a few days of clean Sonnet 5 cost data. Photos can't benefit (different every item). See [[Costs]].