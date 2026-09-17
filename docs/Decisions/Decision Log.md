# Decision Log

What we chose and why, newest first. Dates come from git history. See [[Home]].

| Date | Decision | Why |
|---|---|---|
| 2026-09-16 | Title keywords: AI-generated, SEO-ranked Tier 1/2/3 after color; overflow to Theme only | The AI only added keywords it could read in photos. Google-style "what do buyers search" thinking was missing. See [[Title Keywords Plan]]. |
| 2026-09-16 | Keyword chips clickable from day one; every chip must be placed in the title or Theme | Quick reordering without orphan keywords. The app does it, so no AI cost. |
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
