# Design Brief — eBay Lister Redesign

**Status: brief written 2026-09-16, for Claude Design mockups.** Copy everything below the line into Claude Design. See [[Home]], [[Overview]].

---

## What this app is
An internal tool for a husband-and-wife eBay clothing reselling business (Aaron and Shannon), making **200–400 listings a month**. They photograph clothing (often on a phone), an AI writes the listing, they review and edit it, and publish to eBay. They also track which thrift stores are worth visiting.

## The goal of the redesign
**A clean layout that uses all available space effectively, so there is far less scrolling.**
- On desktop: use the full screen width (wide monitors), with multiple columns instead of one long narrow column.
- On phone: compact, thumb-friendly, with the most-used actions always reachable.
- Keep important actions (Analyze, Save, List on eBay) always visible, never buried at the bottom of a long page.
- Clean, calm, professional. Light theme with a dark mode. Minimal decoration.

## Hard rules (do not break)
- **Layout and styling only.** Every field, button, status message, and popup listed below must still exist and work the same way. Things can be moved, grouped, collapsed, or put in tabs, but nothing can be removed.
- Two device targets: **desktop browser** and **Android phone** (Chrome).
- The Camera screen is full-screen on the phone with no navigation bar.

---

## Screen 1: Navigation (all screens)
**Today:** desktop top bar with Create Listing, Camera, Drafts, Sourcing, Settings. Phone bottom bar with Library, Create, a large round Camera button, Drafts, and More (a popup with Sourcing and Settings). Desktop has **no Library link** (add one).
**Design:** a consistent nav on both. Desktop could be a slim left sidebar or a top bar; keep the phone bottom bar with the prominent Camera button.

## Screen 2: Create Listing (MOST IMPORTANT, and the worst for scrolling)
Where listings are made and edited. Used heavily on desktop.

**Must keep:**
- **Photo library panel** (desktop): folder tabs (All / Shannon / Aaron), Upload Photos, Delete (n), Note, move-to-folder buttons, Clear, a photo grid with multi-select and drag-to-zones, double-click lightbox, "Load older photos". Collapsible.
- **AI Note** and **Draft Note** text boxes (each turns red when it has text).
- **Research buttons:** Google (pick-a-photo mode that highlights the photo zone amber) and eBay (search).
- **eBay Listing Photos zone:** reorderable thumbnails, first photo marked MAIN, remove X, add/drop area, lightbox.
- **AI Analysis Photos zone:** same, limited to 8 (n/8 badge).
- **Buttons:** Analyze Photos (with progress text like "Analyzing photos…" / "Looking up style number…"), Save Draft / Update Draft (with "Draft saved" confirmation).
- **Status:** error line; Style Lookup banner (green found / grey not found / red failed).
- **Listing form**, in this logical order:
  1. **Title** (80 characters with a live counter), then **Keyword chips** under it: rows for Tier 1 / Tier 2 / Tier 3, each chip solid blue (in title) or outlined with a "Theme" tag (in Theme), a legend, help text, and a warning line
  2. **Category** dropdown (full path) + a red "NEW — configure in Settings" warning state
  3. **SKU** (required; red when empty, with help text)
  4. **Item Specifics:** "Required" group and "Additional" group of searchable dropdown pickers (search, pick one or many, add your own). **The Additional list can be dozens of fields — the biggest scrolling problem.** Includes "AI is filling item specifics…" loading state.
  5. **Condition** dropdown + **Condition Description** (only for Pre-Owned)
  6. **Description** (long text; currently grows to full length)
  7. **Pricing:** Format (Buy It Now / Auction), Price, Quantity
  8. **Allow Offers** toggle → Minimum Offer, Auto Accept
  9. **Schedule Listing** toggle → Date, Time
  10. **Shipping:** Shipping Policy, Package Weight (lbs, oz), Package Dimensions (L × W × H), Item Origin (read-only)
  11. **Payment Policy**, **Return Policy** (or "Add in Settings" links when empty)
  12. **Promote Listing** toggle → Ad rate %
  13. **Submit:** result box (green success with link / red failure message), **List on eBay** button (or "Schedule Listing for <date>"), disabled until title, category, price and SKU are filled, with a hint line
- **Sold Comps panel:** Average / Low / High / Results, a list of results with a price button that copies the price into Price. It is currently at the very bottom, far from the Price field.
- **Success popup:** photo, "Listed on eBay!", promotion result, View on eBay, Generate New Listing.

**Layout ideas to reduce scrolling** (designer's choice):
- Desktop: **multi-column workspace**. For example: photo library | photos + notes | listing form, or photos on the left and the form on the right.
- A **sticky action bar** with Analyze, Save Draft and List on eBay always visible.
- Put **Sold Comps next to Price**.
- **Collapse "Additional" item specifics** (show filled ones, expand for the rest) or use a denser 3–4 column grid.
- Description with a fixed height and its own scroll.
- Weight and dimensions on one row; policies side by side; toggles (Offers, Schedule, Promote) compact in one area.
- Photo zones as compact strips instead of tall boxes.

## Screen 3: Camera (phone only, full screen)
**Capture:** top bar (close X, photo count, flash), **square viewfinder** (tap to focus), controls only when supported (ISO slider + Auto, Shutter slider + Auto, White balance Auto + Indoor / Cool / Daylight / Cloudy presets), zoom 1x / 2x / 3x, thumbnail strip with remove X, bottom row: flip camera, large shutter button, Done (n).
**Review:** header (← Retake, "Review (n photos)", "k for AI"), help text, 3-column photo grid (tap to toggle AI selection with a blue check; #number badge; delete X), bottom bar with **AI Note** and **Draft Note** buttons (check mark when filled) and **Create Draft (n photos, k AI)** with "Uploading i/n…" progress. Note editor popup: text box, red X cancel, green check save.
**Design:** maximize the viewfinder; keep controls reachable one-handed; keep the controls compact so they don't shrink the viewfinder.

## Screen 4: Drafts
List of drafts: thumbnail, title, status pill (Processing with spinner, not clickable / Error in red with the error message), condition and date, delete (with confirm), Refresh button, empty state with a Create Listing link. Auto-refreshes while processing.
**Design:** denser rows or a grid of cards on desktop so more drafts fit on screen; consider search/filter by status (optional).

## Screen 5: Photo Library
Header with folder tabs (All / Shannon / Aaron), Upload (drop area with progress), Delete (n), Note, move-to-folder, Clear. Photo grid (3–6 columns) with tap to select, note badge, lightbox, Load older photos, empty state. On selection, a **send-to bar**: "eBay Listing" and "AI Analysis" (sends photos to Create Listing, with a progress fill and check). Note popup for measurements/tag info.
**Design:** maximize photos per screen; keep the send-to bar reachable on the phone.

## Screen 6: Sourcing
Header, **+ Log Trip**, **+ Add Store**, **List / Map** toggle, color legend (green 7+ / yellow 4–7 / red under 4 items per visit; gray = no visits).
- **List:** store cards ranked by items per visit. Each has a colored dot, name, address, "N items · V visits · X/visit", a quality mix line "B&B (x%) · Med (y%) · High (z%)", edit and delete. It expands to a trip history (each deletable) and "+ Log a trip to <store>".
- **Map:** colored pins with a popup (name, items, visits, per visit), "Locate on map" and "Re-locate all pins" buttons, empty states.
- **Popups:** Add/Edit Store (name, address). Log Trip (store dropdown, date, three counts — Bread & Butter / Medium / High — each with a number box and big up/down arrows; large and stacked on the phone).
**Design:** on desktop, show the list and map side by side instead of toggling.

## Screen 7: Settings
Sections: **Categories**, **Policies**, **eBay Account**.
- **Categories:** search eBay categories + Add; saved category cards (expand to checkboxes marking which item specifics allow multiple values; Remove).
- **Policies:** three groups (Payment / Shipping / Return), each with + Add and rows of: default star, Policy ID, Label, Remove. The rows are cramped on a phone.
- **eBay Account:** a one-time 3-step connection (Authorize with eBay → Exchange code → copy refresh token). It currently loses the Settings navigation — keep it inside Settings.

## Screen 8: Home
Currently just a title, tagline and a Create Listing button. **Optional:** could become a simple dashboard (e.g. drafts waiting, processing count, shortcuts), or go straight to Create Listing.
