# Markdown Plan

**Status: concept, nothing built (2026-10-07).** Asked for as a full design
before any code. See [[Future Features]] #1, [[Old Listings (Parked)]],
[[Seasonal Hold Plan]], [[Listed Report Plan]].

> *"Auto is a little uncomfortable, if it screws up it can cost a lot of
> money."* — and that is the correct instinct. This is the only feature in the
> app that can lose money unattended. Everything below is built around that.

## The three questions, answered first

**Does the AI do the markdowns? No.** Not anywhere in the path. A markdown is
arithmetic against rules the sellers set: age, price, floor, step. AI would
add cost, run-to-run variance and an unexplainable answer to the one process
that must be identical every time and auditable afterwards. When a price comes
out wrong you need to point at a rule, not at a model's judgement. The AI's
job ends at the listing.

**Is it coded into the app? Yes.** A scheduled job, the same shape as the
seasonal-hold poster in `api/cron/post-held` — wakes on a schedule, reads
eBay, applies rules, writes a record of everything it did.

**Half of it already exists.** The parked `old-listings` branch pulls active
listings with age, watchers, views, impressions and click rate, read-only.
That is the input this whole feature needs.

## The shape: three stages, not one switch
The discomfort is about going straight to a machine changing prices. So don't.

**Stage 1 — Report only (weeks 1–4).** The job runs daily and writes down what
it *would* have done. **It makes no calls that change anything.** You read the
list each morning and judge whether the rules match what you would have done
by hand. Nothing can go wrong because nothing is written.

This doubles as the thing the whole feature depends on: **you do not yet know
your own days-to-sell curve.** Any markdown schedule chosen today is guesswork.
Four weeks of "what would have happened" plus what actually sold turns it into
a measurement.

**Stage 2 — Approve and apply.** A screen listing today's proposed changes:
item, current price, proposed price, why. Tick the ones you want, press apply.
The rules do the thinking, you keep the decision. This is where it should sit
for a good while, and it may be where it stays.

**Stage 3 — Automatic, with rails.** Only for the rules that have proved
themselves over months, and only inside the limits below. A rule earns
automation by being right repeatedly, one rule at a time — not the whole
system at once.

## The rules themselves
Each is independent and can be turned on, tuned, or turned off alone.

**Age markdown.** Listed N days with no sale → reduce by X%. Then again at a
longer interval. Suggested start: 30 days −5%, 60 days −5%, 90 days −5%,
stopping at the floor. Those numbers are a *starting guess to be replaced by
Stage 1 data*, not a recommendation.

**Season-end markdown** (users' idea 2026-09-21). Drop the price as an item's
season ends — parkas in spring — **and only for items whose season is
ending**, never "it is old so mark it down". Uses the same season dates as
[[Seasonal Hold Plan]]. Preferred over ending and relisting, which loses the
watchers and the search history the listing has built up.

**Offers to watchers.** Listed 14+ days, has watchers, no offer sent in the
last 7 days → send watchers an offer. This is NOT a markdown: the listing
price does not change, so it cannot ratchet down. Lower risk than a price cut
and historically converts well. eBay's Negotiation API requires **at least 5%
off** ([[Old Listings (Parked)]]).

**Nothing happens to an item until it has been listed long enough to have had
a fair chance.** A markdown on day 3 is money given away.

## The rails, in detail
Every one of these is a hard stop, not a warning.

| Rail | What it does |
|---|---|
| **Floor price** | Never below cost + eBay fees + shipping + a minimum margin. The purchase cost is already recorded per item in the Listed record (`listedLog.js`). |
| **No cost, no markdown** | An item with no recorded cost has no computable floor, so it is skipped and flagged rather than guessed at. |
| **Max single step** | One markdown can never exceed X% (suggest 5–10%). |
| **Max cumulative** | Total reduction from the original price capped (suggest 25–30%). |
| **Minimum age** | Nothing is touched before N days live. |
| **Minimum gap** | An item cannot be marked down twice within N days. |
| **Daily cap** | The job may change at most N items a day. A bug then costs N items, not the whole store. |
| **Exclusions** | A per-item "never touch" flag, plus whole categories or brands. |
| **Kill switch** | One setting that stops every write immediately, without a deploy. |

**The guard that matters most: price drift.** Before changing anything, check
eBay's current price against what the app last set. If they differ, somebody
changed it by hand — **skip the item and flag it**. Without this the job will
one day quietly undo a deliberate price change.

## What could actually go wrong
Worth writing down, because "auto" fails in specific ways:

- **A bug prices everything at the floor.** Caught by: max single step, max
  cumulative, daily cap. Cost is bounded by the daily cap.
- **The job runs twice** (retry, double cron, manual trigger). Caught by:
  recording per item the date and step of the last markdown, and making the
  rule idempotent — "step 2 applied today" can only happen once.
- **It dies halfway through.** Per-item records, so a resumed run picks up
  where it stopped rather than restarting.
- **It fights a human.** The price-drift guard above.
- **Season logic marks the wrong things.** Season markdown only ever applies
  to items whose own season is ending.
- **Watchers get offered repeatedly.** The 7-day gap, and a record per item of
  when an offer was last sent.
- **eBay rejects the change** (listing ended, sold, out of sync). Each item is
  its own try/catch; one failure never stops the run.
- **Everything is logged** — item, before, after, which rule, when. Without the
  log there is no way to answer "why is this $18".

## eBay's markdown promotions — checked 2026-10-07
Aaron's choice: **eBay's own sale feature with the crossed-out price**, not a
plain price edit. Verified against eBay's developer docs
([createItemPriceMarkdownPromotion](https://developer.ebay.com/api-docs/sell/marketing/resources/item_price_markdown/methods/createItemPriceMarkdownPromotion),
[Creating discounts](https://developer.ebay.com/api-docs/sell/static/marketing/pm-creating-discounts.html)):

- **The API is `createItemPriceMarkdownPromotion`** on the Marketing API.
  Required: the marketplace, the items, the discount, and **start and end
  dates**. The discount may be a percentage or a fixed amount.
- **There is a DRAFT state.** A promotion goes `DRAFT` → `SCHEDULED` →
  `RUNNING` → `ENDED`, and a seller can create it as a draft to preview before
  activating. **This is Stage 2, provided by eBay** — the app proposes, eBay
  holds it unapplied, the seller activates. No approval UI needs inventing.
- **They expire. Maximum 45 days** on the US marketplace (14 days on the
  European ones). So a markdown is a *sale event*, not a permanent price cut.
  The design becomes rolling sale events, which is safer: nothing is
  permanent and a mistake unwinds itself when the event ends.
- **Up to 500 items per promotion**, selected by listing ID or by rule
  (brand, category, condition, price range). Rule-based selection may replace
  much of the per-item logic planned below — worth testing before building it.

### The lifecycle — four calls (verified 2026-10-07)
| What | Call |
|---|---|
| Create | `createItemPriceMarkdownPromotion` — may be created as `DRAFT` |
| Read | `getItemPriceMarkdownPromotion` |
| Change | `updateItemPriceMarkdownPromotion` |
| Remove | `deleteItemPriceMarkdownPromotion` |

**The scope is already granted.** `sell.marketing` is in the list
`getUserToken` requests (`src/lib/ebay.js`), so no re-authorising is needed.

**A RUNNING promotion cannot be deleted.** Delete works on `DRAFT`,
`SCHEDULED` and `ENDED` only. To stop a live sale you call `update` and move
the **end date** to now. That is also the emergency stop: one update per
running promotion ends every markdown on the account.

**A RUNNING promotion's discount cannot be changed.** Update allows the end
date and the item list, but not the discount or the start date. So deepening a
markdown is *end the current one and create a new one*, never an edit. Anyone
designing a ratchet needs to know that first.

**What the app actually does, then:** gather listing IDs, create a promotion
as a draft, let the seller activate it, and end ones that have served their
purpose. Four API calls and some arithmetic. **No AI in the path at any
point.**

**Still unverified:** whether there is a minimum discount, whether the price
reverts cleanly at the end, and whether an item can move straight into another
promotion afterwards. The reachable docs do not say.

## How an item's season is determined — it already is (2026-10-07)
Checked against the real drafts: **39 of 42 carry eBay's `Season` item
specific**, filled by the AI during Pass 2 and already sent on the listing.

```
Fall,Winter 12 · Spring,Summer 14 · Summer 12 · Spring,Fall 1
```

Flannel jackets come back `Fall,Winter`; shorts `Spring,Summer` or `Summer`.
Every category is fully populated **except Swimwear, blank on all three** —
odd, given it is the most seasonal thing they sell, and worth looking at.

**Three sources, in order of preference:**
1. **The `Season` item specific** — present on 93% of drafts, in eBay's own
   vocabulary, already on the live listing.
2. **The category** as a fallback — Coats & Jackets → fall/winter, Swimwear →
   summer. Covers the blanks without needing a person.
3. **A manual override** for the one that is wrong.

**A season is often two seasons.** `Spring,Summer` means the clearance trigger
is the end of the **later** one — do not clear shorts in June because spring
ended. Easy to get backwards.

**The better signal is currently thrown away.** When a held draft posts, the
cron clears `holdSeason` (`api/cron/post-held/route.js`) and the Listed record
never stored it. That is the season the *seller* chose deliberately, which
beats the AI's guess. Writing it into the Listed record at posting time is a
few lines, worth doing whenever that code is next touched.

## The floor: 20% margin (Aaron, 2026-10-07)
Goal stated as **both** — *"I need cash, but at the same time I dont want to
go down to 20% margin."* So: sell faster, with a hard floor at 20%.

**The percentage is unlikely to be what actually stops a markdown.** The floor
has to clear cost + postage + eBay's cut + the 5% Promoted Listings rate, and
on cheaply-sourced clothing the *fixed* costs bind long before the margin
percentage does. A $5 jacket at $40 sits far above 20%. Where 20% bites is an
expensive source or a heavy coat whose postage eats the gap.

**Derive the fee rate from real orders, don't assume it.** eBay returns the
actual fees on completed sales, and they vary by category and change over
time. Taking the effective rate from the sellers' own order history makes the
floor a measurement rather than arithmetic someone guessed — the same approach
used for AI cost in [[Costs]] and measurements in [[Description Plan]].

**Open, needed to finish the formula:**
1. Margin of *what* — profit ÷ the price the buyer pays, or profit ÷ total
   outlay? They give materially different floors.
2. Does the 20% include the 5% ad rate, or is that on top?

## What has to be checked against eBay before building
Flagged rather than assumed, per the repo rule. Some of this is recorded in
[[Old Listings (Parked)]] from when that branch was built and may have moved:

1. **Which mechanism to use for a price drop.** Three exist, and they are not
   equivalent: changing the offer price directly; eBay's own markdown/sale
   feature (which shows the crossed-out "was" price and usually converts
   better); and Send Offer to Interested Buyers (which does not change the
   listing price at all). Which is right — and whether the sale feature has
   its own rules about duration and depth — decides the whole design.
2. **Negotiation API limits** — minimum 5% off is recorded; how often the same
   watchers may be offered is not.
3. **Analytics limits** — 100 calls/day for the account, 200 listing IDs per
   call, 90-day window. That caps how many listings can be assessed daily.
4. **Inventory-API listings and older listings need different calls** for a
   price change.
5. **Whether a price change affects search placement.** If eBay treats an
   edited listing differently, that changes whether markdown or relist is
   better.

## What the sellers need to decide
1. **What is the goal — faster turnover, or protecting margin?** The schedule
   follows from that answer and nothing else.
2. **The floor rule.** Cost plus fees plus shipping plus *what*? A fixed
   dollar margin, or a percentage?
3. **How long is "long enough"** before the first markdown?
4. **Does Stage 3 ever happen**, or is Stage 2 good enough? Approving a short
   list each morning is a minute's work and keeps a person in the loop. There
   is no obligation to automate it.

## Deliberately not in scope
- Raising prices automatically. Nothing here ever increases a price.
- Ending or relisting listings — considered and dropped (loses watchers and
  search history).
- Any AI involvement in choosing a price.
