# Old Listings (Parked)

> **Status: BUILT and tested 2026-09-18, PARKED — not in the live app.** The finished code lives on the git branch **`old-listings`** (commits `ff38bd2` report + `8f4e219` click rate), kept off `main` so other work can go live without it.
>
> **To bring it back:** tell Claude "bring back Old Listings". Claude merges the `old-listings` branch into `main`, re-runs lint/build, checks it against live eBay data (read-only), and waits for "push it". Nothing needs rebuilding.

Desktop tab (rail: Create · **Old** · Settings) at `/old-listings`. See [[Home]], [[Future Features]].

## What it shows
Active eBay listings live **90+ days**, oldest first: photo, title, SKU, price, days live, watchers, views and impressions (last 90 days), and **click rate** = views ÷ impressions (worked out by the app — eBay's own `CLICK_THROUGH_RATE` comes back rounded to 0 / 0.01 / 0.02, too coarse). Low impressions = eBay isn't showing it (title/category/specifics); shown a lot but low click rate = skipped in search (main photo/price); views but no sale = price/condition/shipping. Summary boxes (count, no watchers, under 10 views, value sitting), filter chips (All / No watchers / Under 10 views / Has watchers), sortable columns. Click a row → opens the listing on eBay. **Read-only** — nothing on eBay changes.

## Where the data comes from (checked against eBay's docs 2026-09-18, tested live)
- **Trading API `GetMyeBaySelling`** (ActiveList, 200 per page): every active listing however it was made (eBay website, older tools, this app). Gives start time, price, quantity, SKU, **WatchCount** (left out when 0). `StartTime` stays the original date through Good 'Til Cancelled monthly renewals. Called with the user OAuth token in `X-EBAY-API-IAF-TOKEN`.
- **Sell Analytics traffic report** (`dimension=LISTING`): `LISTING_VIEWS_TOTAL`, `TOTAL_IMPRESSION_TOTAL`. Max 90-day window (so "views" = last 90 days, not lifetime), 200 listing IDs per call, **100 calls/day for the account**. Needs `sell.analytics.readonly` — fetched with its own token (`getScopedUserToken`) so the listing flow's token is untouched.
- The Inventory API can't do this (only sees listings it created).
- First live run: 801 active, 370 old, ~8 s, 2 traffic calls.

## Caching
The last report is saved in the browser (localStorage `lister.oldListings.v1`) and only re-run on **Refresh** (or the first visit), to stay well under eBay's 100/day.

## Later (not built)
Actions from the report, each needing its own approval: send offer to watchers (Negotiation API, min 5% off), lower price, end listing, relist (new item ID, same SKU — discuss against the SKU rule first). Inventory-API listings and older listings use different calls for price changes / ending.
