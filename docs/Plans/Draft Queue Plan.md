# Draft Queue Plan (desktop)

**Status: PLANNED, agreed 2026-09-17, not designed or built yet.** Part of the desktop redesign. See [[Design Brief]], [[Drafts and Camera Flow]], [[Decision Log]].

## Goal
Work through drafts one after another on the desktop Create Listing screen without leaving the page. Typical flow: shoot a batch with the Camera, then sit down and finish the drafts in order.

## Spec
- **Left panel switch: Photos | Drafts.**
  - **Photos:** the existing photo library, unchanged (drag into zones, etc.).
  - **Drafts:** a compact list (thumbnail, title, status). Kept clean: no action buttons in the list.
- **Clicking a draft swaps only the listing area.** No page reload; the panel keeps its place. The URL updates to `?draft=<id>` so a refresh still works.
- **"Next draft" = the oldest draft** that is:
  - not marked **Skip Draft**, and
  - not **Processing** (still being written in the background; opening it risks the background save and the user's edits overwriting each other)
  - **Error drafts are included**, so they can be fixed.
- **Skip Draft checkbox** under the Draft Note, in the listing area (not in the list):
  - **Sticks** until unchecked (stored on the draft).
  - **Saves immediately** when checked or unchecked (no Save click, no unsaved-changes prompt for it).
  - The Drafts list shows a small grey **"Skipped"** label.
- **After a successful List on eBay** (changed 2026-09-18; before, it waited for a Next draft click):
  - The app **moves on automatically**: it opens the oldest eligible draft, or a **blank new listing** if none is waiting (not the "all caught up" screen).
  - "Listed on eBay! Item … · promotion result" with **View on eBay** and ✕. No photo, no Next draft / New listing buttons. Desktop: centered in the top action bar so nothing below moves. Phone: pinned above the action buttons.
  - It disappears after **10 seconds**. A promotion problem (amber) stays until dismissed.
- **Desktop top bar:** the heading shows the item's short name, Brand + Style + Type cut from the title (e.g. "Ariat Long Sleeve T-Shirt"); "Create Listing" when there's no title. The "Title, category, price and SKU complete/needed" text was removed. Short messages (listed, analyzing, draft deleted, style lookup) show centered in the top bar; errors stay in the lane under it.
- **No drafts left:** show **"You're all caught up 🎉"** only.
- **Unsaved changes:** switching drafts (by clicking a draft or Next) asks **"Save changes? Save / Discard / Cancel."**
- **Cloudinary rate limit:** the Drafts list loads once and refreshes **only** after save/publish, when Next draft is clicked, or via the **Refresh** button. **No automatic polling at all** (users chose manual refresh; Processing drafts update when Refresh is clicked). See [[Photos and Cloudinary]].
- **List order:** oldest → newest, so Next draft is the next row down.
- **Skipped drafts can still be opened** by clicking them; only Next draft passes over them.
- **Next draft** refreshes the list first, then opens the oldest eligible draft, or shows "You're all caught up 🎉" if none.
- **Count label:** "12 drafts" (total), not "in queue".
- **Design status:** mocked up in Claude Design 2026-09-17 (panel, spine, dark, Skip Draft, save prompt, empty state, success bar with Next draft) and approved with the clarifications above.
- **New listing** button (desktop action bar; phone ••• menu): clears the form and both photo zones, deselects the draft, uses the Save / Discard / Cancel prompt if there are unsaved edits. Does not create a draft; Save Draft does.
- **Delete Draft** (desktop draft area; phone ••• menu) with a confirm reading "Deletes this draft. Its photos stay in your Photo Library. Nothing on eBay changes." After deleting, the form goes blank; nothing auto-opens (tap Next draft). Decided 2026-09-18. Skip Draft and Delete Draft are hidden on a blank, unsaved listing.
- **Error drafts** show their error message in the status lane when opened.
- **Phone:** keeps Skip Draft (under Draft Note), decided 2026-09-17; after listing it moves to the next draft automatically like desktop.
- **Success = message only, no popup** (both devices): see "After a successful List on eBay" above.
- **Published drafts** are removed from the panel immediately; no row stays highlighted and the count drops by one (the app already deletes them on publish).
- **Two users at once:** not handled for now (users' call). The SKU check still prevents posting the same item twice.
- **Cost:** $0, no AI.

## Open for design
- Where the Photos | Drafts switch sits in the panel.
- Draft row design (thumbnail, title, status pill, Skipped label) at panel width, including the collapsed 40px spine.
- Placement of the Next draft button within the pinned success result.
- The "all caught up" empty state.
