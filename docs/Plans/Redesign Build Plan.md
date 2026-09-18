# Redesign Build Plan

**Status: PLAN, written 2026-09-18, waiting for go-ahead.** Design finished in Claude Design (v43). Export lives in `design/` (9 screen files, `lister-theme_3.css`, `README_2.md`). See [[Design Brief]], [[Draft Queue Plan]], [[Decision Log]].

## Ground rules
- Nothing goes live until the users say so. Each step is saved separately so it can be undone.
- The "brains" stay shared: analysis, keywords, item specifics, SKU check, publishing. Only the listed behaviour changes touch logic.
- Claude never writes test data to Cloudinary. Save / Skip / Delete / List on eBay are tested by the users on real work, on the local copy.
- The design's style file is renamed/scoped so it cannot change pages that are not converted yet.
- Geist font kept. Dark mode follows the device; the toggle comes later.
- Design wording is not copied blindly: the app's real messages and rules win (see the checks in [[Decision Log]]).

## Steps
1. **Foundation.** Theme (colours, sizes, dark mode), desktop rail (logo, Create Listing, Settings), phone bottom bar + More sheet (Settings), front page opens Create Listing, Sourcing unlinked.
2. **Desktop Create Listing layout.** Fixed action bar, status lane, 4 columns, collapsible library panel, two scrolling form panes, collapsed Additional specifics, fixed-height description, one-row pricing, success bar (no popup), Sold Comps removed.
3. **Desktop draft queue.** Photos | Drafts panel, Next draft, Skip Draft (saves only the skip mark), New listing, Delete Draft (form goes blank after), Error message in lane, Save / Discard / Cancel prompt, guard against one draft's late data landing on another.
4. **Phone Create Listing.** Tabs (Photos / Details / Specifics / Price / Ship), labelled action bar, two status strips, ••• menu (New listing, Delete Draft), picker bottom sheet with eBay's value limit, dismissable style banner, Next draft + Skip Draft, Sold Comps removed.
5. **Camera.** Restyle, 3×3 grid (on screen only), Back keeps photos/AI picks/notes, empty strip keeps its space, flash stays on/off.
6. **Phone Drafts.** Oldest first by created date, "Created" date, no auto-refresh, Skipped pill, error wraps.
7. **Phone Photo Library.** 4 across, Add tile, three selection rows, Note single-photo, lightbox arrows + swipe + file name + note, no total count.
8. **Settings.** Desktop + phone, eBay Account kept inside Settings, two-line policy rows on phone, category Search button.
9. **Test and go live.** Claude tests every screen in light/dark at desktop and phone sizes; users test save/skip/delete/publish locally; then go live when the users say.

## Behaviour changes (everything else is looks only)
- Draft queue, New listing, Delete Draft, Skip Draft (desktop + phone).
- Success shown as a pinned bar; popup removed.
- Camera Back keeps photos.
- Drafts list: oldest first, no 5-second auto-refresh (helps the Cloudinary limit).
- Settings: eBay Account stays inside Settings.
- Front page opens Create Listing; Sourcing unlinked.

## Screen sizes (decided 2026-09-18)
- Big desktop windows (about 1280px and wider): the desktop design.
- Everything smaller (phones, tablets, small laptops): the phone design, centred at a sensible width. The old layouts can be removed once the new ones are live.
