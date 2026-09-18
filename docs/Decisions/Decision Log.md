# Decision Log

What we chose and why, newest first. Dates come from git history. See [[Home]].

| Date | Decision | Why |
|---|---|---|
| 2026-09-16 | Title keywords: AI-generated, SEO-ranked Tier 1/2/3 after color; overflow to Theme only | The AI only added keywords it could read in photos. Google-style "what do buyers search" thinking was missing. See [[Title Keywords Plan]]. |
| 2026-09-16 | Keyword chips clickable from day one; every chip must be placed in the title or Theme | Quick reordering without orphan keywords. The app does it, so no AI cost. |
| 2026-09-17 | Draft queue on desktop: Photos \| Drafts panel, oldest-first Next draft (manual button), sticky Skip Draft that saves instantly, save prompt on switch (confetti dropped) | Finish camera batches without leaving the page. Processing drafts are still passed over so background saves can't overwrite edits. See [[Draft Queue Plan]]. |
| 2026-09-18 | Schedule Listing off by default (drafts without a schedule date open with it off); Allow Offers and Promote stay on | Listings are rarely scheduled. The old default was "on" with no date, which never scheduled anything. |
| 2026-09-18 | Minimum offer fills in automatically at 25% off the price (no AI); typing your own stops it for that listing, clearing the box brings it back; drafts with a saved minimum keep it | Saves typing on every listing while keeping full control. |
| 2026-09-18 | Redesign built (steps 1–9), not live. Extra calls made while building: camera ✕ asks before discarding photos; Save/List locked after a listing goes live; Settings saves one category at a time | ✕ used to jump to Review, which with the new Back button would loop. Locking avoids re-saving a published listing as a new draft. One-category saves fix the category-wipe bug. See [[Redesign Build Plan]]. |
| 2026-09-17 | No Home screen: the logo and the site's front page open Create Listing. Settings keeps eBay Account inside it (no lost navigation). Redesign of all screens finished in Claude Design (v43) except Sourcing | Home was just a button to Create Listing; skipping it saves a click and a screen. |
| 2026-09-17 | Sourcing taken out of the menu (desktop rail and phone More sheet) for now; not redesigned. The page and all store/trip data stay, reachable at /sourcing. Desktop menu = Create, Settings | Users want to move on with the redesign. Nothing deleted; it can be added back any time. See [[Sourcing]]. |
| 2026-09-17 | Camera: 3×3 grid over the viewfinder, always on, on-screen only (never in the photo). Empty thumbnail strip keeps its space so nothing moves on the first shot. Not built yet | Helps line up items. The strip rule protects an existing fix: a layout jump on the first shot made users re-aim and change perspective. |
| 2026-09-17 | Camera review: "← Retake" becomes "← Back" and keeps all photos, AI picks and notes (new shots are added at the end). Not built yet | Retake deleted every photo, so one missed shot meant reshooting the whole item. Close (X) or removing photos is the way to start fresh. |
| 2026-09-17 | Desktop menu drops Camera too (phone only). Desktop menu = Create, Sourcing, Settings |  Camera is only used on the phone. |
| 2026-09-17 | Desktop menu drops Library and Drafts; phone keeps both tabs. The pages themselves stay in the app | Desktop Create Listing's Photos \| Drafts panel covers both. The phone has no panel, so its tabs are still how photos are sent and drafts opened. |
| 2026-09-17 | Redesign: success shown as a pinned bar only (popup dropped); New listing and Delete Draft buttons; phone keeps Next draft + Skip Draft; analyze shows only real steps (no photo counts); errors read "Failed: " + eBay's exact words | Keep results visible and honest; one place to start over. See [[Draft Queue Plan]]. |
| 2026-09-17 | Sold Comps removed from the redesign | It only showed the most expensive active listings, not sold prices, and took up space. |
| 2026-09-16 | SKU required (no auto-generated SKUs); any SKU ever used — live, sold, or ended — is blocked before anything is sent to eBay; failed lookups stop the post | A duplicate SKU overwrote live listings (items had to be reshot). Forgotten SKUs were being auto-generated, which the users don't want. See [[Orphan Offers and SKUs]]. |
| 2026-09-16 | Re-analyzing a draft redoes the listing from the photos (AI fields only); saving stays manual via Update Draft; confirmation first | Re-analyze left item specifics and Theme empty. Users want "square one" but must not lose typed info (price, SKU, weight, policies) or overwrite a draft by accident. |
| 2026-09-16 | No keyword log for now | The AI ranks keywords well on its own (like asking Google). A log would add an extra AI step, a shared file two users could overwrite, a page to build, and a way to repeat bad keywords with no delete. Revisit if titles seem inconsistent. |
| 2026-09-16 | Code strips words already in the title from keywords | First live test produced "T-Shirt … Sun Shirt Athletic Shirt". eBay matches words anywhere in the title, so shorter keywords lose nothing and save room. |
| 2026-09-16 | Title changes sync to the description's title line | Description must match the eBay title; fixes an existing gap with hand-edited titles. |
| 2026-09-16 | Docs vault in `docs/`, opened in Obsidian | Long conversations get summarized and rules were being forgotten. Notes persist and are backed up in git. |
| 2026-06-22 | Camera drafts: client sends the draft ID | Fire-and-forget request was retried by the platform and created duplicate drafts. A stable ID makes retries overwrite. See [[Drafts and Camera Flow]]. |
| 2026-06-13 | Google Geocoding for Sourcing pins, free Nominatim as fallback | Nominatim placed some stores (Goodwill Britton, Retreads) on the wrong spot. Google is accurate and stays within its free allowance. |
| 2026-06-13 | Sourcing map: Leaflet + OpenStreetMap | Free, no setup, no API key. |
| 2026-06-13 | Sourcing ranks by raw items per visit (green >7, yellow 4–7, red <4) | Users' own thresholds. Quality tiers are shown as counts and percentages but not weighted. |
| 2026-06-13 | Sourcing trip modal forces choosing a store | Prevents logging a trip to the wrong store. The per-store "Log a trip" button still pre-selects. |
| 2026-06 | EPS stays as-is, no fallback to Cloudinary URLs | The one 190204 failure was transient and publishing worked on retry. |
| 2026-06-06 | No in-app cost tracker; `[COST]` / `[POST]` lines in Vercel logs | Users preferred Vercel logs. |
| 2026-06-06 | Pass 2 JSON sent compact, value cap left at 200 for now | Compaction is free savings. Cutting the cap risks dropping correct values. |
| 2026-06-05 | Condition dropdown filtered by eBay's rules for the category | Jerseys rejected "Pre-Owned Excellent" (2990). eBay publishes per-category allowed conditions. |
| 2026-06-05 | AI Note + Draft Note | AI Note guides analysis; Draft Note is internal only and never reaches the AI or eBay. |
| 2026-05-28 | Failed publish deletes its orphan offer; old UNPUBLISHED orphans are auto-reclaimed | Failed publishes were "burning" SKUs. PUBLISHED offers are never touched. |
| 2026-05-28 | Listing photos uploaded to eBay's own hosting (EPS) before publish | Cloudinary URLs break revisions if photos are later deleted. |
| 2026-05-10 | Camera: white balance preset buttons; post-capture color correction reverted | The phone's driver ignores precise temperatures; users didn't want the correction. |
| 2026-05-08 | Library "Load older photos" pagination | Photos past the first 500 were hidden. |
| 2026-05-08 | Auto-select a business policy when only one option exists | Saves clicks. |
| 2026-04-27 | Google Lens + eBay search research buttons on Create Listing | Faster item research; eBay search uses Brand + Style + Type only. |
| 2026-04-22 | Title order: Brand, Style, Type, **Gender, Size**, Color | Users' preferred order. |
| 2026-04-22 | Sold comps built from AI observations, filtered by matching condition | More relevant comps. |
