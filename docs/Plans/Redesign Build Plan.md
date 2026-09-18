# Redesign Build Plan

**Status: BUILT on 2026-09-18 (steps 1–9), saved locally, NOT live.** Waiting for the users to look it over and test on their own computer before it goes live. Design export lives in `design/` (9 screen files, `lister-theme_3.css`, `README_2.md`). See [[Design Brief]], [[Draft Queue Plan]], [[Decision Log]].

## Ground rules
- Nothing goes live until the users say so.
- The "brains" stay shared: analysis, keywords, item specifics, SKU check, publishing. Only the listed behaviour changes touch logic.
- Claude never writes test data to Cloudinary. In local testing a browser flag (`localStorage "lister.blockWrites" = "1"`, dev builds only, `src/components/dev/DevWriteGuard.js`) blocks every write to `/api/*` from page load.
- Geist font kept. Dark mode follows the device; the toggle comes later.

## Screen sizes (decided 2026-09-18)
- Big windows (1280px and wider): the desktop design.
- Everything smaller (phones, tablets, small laptops): the phone design, centred (max 640px).
- Measured once when the page opens (`src/hooks/useWide.js`); resizing doesn't flip it — refresh to switch.

## What was built
1. **Foundation.** Theme tokens in `src/app/globals.css` (with `.legacy` keeping Tailwind's text sizes for Sourcing), desktop rail (logo, Create Listing, Settings), phone bottom bar + More sheet (Settings), front page → Create Listing, Sourcing unlinked (`/sourcing` still works, old look).
2. **Desktop Create Listing** (`src/components/create/DesktopCreate.js`): fixed action bar, status lane, library/drafts panel, photos column, two scrolling form panes, Additional specifics collapsed, fixed-height description, one-row pricing, success bar (no popup), Sold Comps removed.
3. **Draft queue** (`src/hooks/useListingEditor.js`, `LibraryPanel.js`): Photos | Drafts panel, Next draft, Skip Draft (PATCH saves only the skip mark), New listing, Delete Draft (form goes blank; "Draft deleted" lane has Next draft), Error message in lane, Save / Discard / Cancel prompt, session guard so late lookups can't land on another draft.
4. **Phone Create Listing** (`PhoneCreate.js`): five tabs, labelled action bar, top lane + pinned strip, ••• menu, picker bottom sheet with eBay's value limit, Next draft + Skip Draft.
5. **Camera**: new look, 3×3 grid, Back keeps photos/AI picks/notes, empty strip keeps its space, torch on/off.
6. **Drafts (phone)**: oldest first by created date, "Created" date, no auto-refresh.
7. **Photo Library (phone)**: 4 across, Add tile, three selection rows, single-photo Note, lightbox with arrows/swipe + file name + note.
8. **Settings**: desktop + phone, eBay Account inside Settings, two-line policy rows on phone.
9. **Checks**: lint + production build pass; every screen checked in the browser at desktop and phone sizes, light and dark, with writes blocked.

## Behaviour changes (everything else is looks only)
- Draft queue, New listing, Delete Draft, Skip Draft (desktop + phone).
- Success shown as a pinned bar; popup removed. After a listing goes live, Save and List are locked until Next draft / New listing (prevents a duplicate draft).
- Camera: Back keeps photos. The close ✕ now asks before discarding photos (it used to jump to Review).
- Drafts list: oldest first, no 5-second auto-refresh.
- Settings: eBay Account stays inside Settings. Category changes are saved one category at a time (fixes the wipe bug, see [[Open Issues]] #0).
- Front page opens Create Listing; Sourcing unlinked.

## Not done / later
- Dark mode toggle (follows device for now).
- Users still need to test: Save / Update Draft, Skip Draft, Delete Draft, List on eBay, Analyze, camera on a real phone.
