# Future Features

Ideas we want to come back to. Nothing here is built or agreed in detail yet. See [[Home]], [[Open Issues]], [[Decision Log]].

## 1. Selling what's already listed: offers to watchers + automatic markdowns (top pick)
- **What:** on a schedule (e.g. every morning), the app checks active eBay listings and applies rules the users set once. No AI — just rules and arithmetic.
  - **Offers:** e.g. listed 14+ days with watchers, no offer sent in the last 7 days → send watchers 10% off (eBay's own "send offer to interested buyers").
  - **Markdowns:** e.g. 30 days → −5%, 60 days → another −5%, never below a floor.
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

## 4. Faster draft finishing — BUILT 2026-09-18
- After a successful listing the app opens the next draft by itself (or a blank listing when none is waiting). The "Listed on eBay!" message shows centered in the top bar for 10 seconds (on the phone, pinned above the buttons). See [[Draft Queue Plan]].
- "Ready to list" mark — not wanted.

## 5. Shipping weight and box size filled in automatically (no AI)
- Save a typical weight and box size per item type once (e.g. tee 8 oz, jeans 1 lb 8 oz, hoodie 1 lb 12 oz).
- The app fills them in when the category is chosen, and you adjust when needed.
- **Why:** it's typed on every single listing. Small per item, but hundreds of times a month.

## 6. Old listing report (items that aren't moving)
- A list of items live 90+ days with no watchers and no views, so you can decide what to relist, bundle, or pull.
- Pairs with #1: markdowns and offers handle slow sellers; this catches items getting no attention at all.
- **Check with eBay's live API before building:** where views and watcher counts come from (likely the traffic report and the listings data), and how far back the data goes.

## Not wanted (decided 2026-09-18)
- Bin location / pick list — pulling orders isn't a problem.
- Duplicate listing warning, daily scoreboard, blurry/dark photo warning.
- Bulk changes to several drafts — not right now.

## Smaller items already noted elsewhere
- Dark mode toggle (follows the device for now).
- Camera autofocus: continuous focus + return to continuous after a tap (watching; see [[Open Issues]]).
- Minimum offer: should drafts saved before the feature also follow the price? (undecided)
- Sourcing redesign (unlinked for now).
