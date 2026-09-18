# Lister — Tailwind export

One stylesheet and one file per screen.

| File | Screen | Viewport |
| --- | --- | --- |
| **`lister-theme.css`** | Design tokens, component classes, responsive layout rules. Every HTML file below links this one. | — |
| **`create-listing.html`** | Desktop Create Listing — the whole form, the Photos \| Drafts panel, the draft queue, the status lane, the blank state and every result state. | ≥ 1280 |
| **`settings.html`** | Desktop Settings — Categories, Policies, eBay Account. | ≥ 1280 |
| **`create-listing-phone.html`** | Phone Create Listing — five tabs, both status strips, the labelled action bar, the picker sheet and the ••• menu, the blank state and every result state. | 390 |
| **`camera.html`** | Phone Camera — capture and review, plus the note editor. Phone only. | 390 |
| **`drafts-phone.html`** | Phone Drafts — the queue, every row state, the empty state. | 390 |
| **`photo-library-phone.html`** | Phone Photo Library — folders, upload, grid, selection, send-to, note popup, lightbox. | 390 |
| **`settings-phone.html`** | Phone Settings — the same three sections at 390px. | 390 |
| **`nav.html`** | Reference sheet: desktop rail expanded and collapsed, phone bottom bar, phone More sheet. | any |

Every file is **markup to integrate, not a runnable demo** — it expects a Tailwind build
step (`lister-theme.css` is the *input*, not the built stylesheet). The small `<script>`
at the end of each one wires only the layout state a static file cannot show — theme,
tabs, disclosure, overlays — and is marked where it needs a real endpoint. The runnable
version is the Design canvas, where every interaction works.

**Where the real state lives.** Each file ships ONE state per element and comments the
others in place, next to the markup they replace. Alternate states are `hidden` in the
markup (`data-state`, `data-pin`, `data-tab`) rather than deleted, so you can flip one on
in dev tools and see it.

**Duplication is deliberate.** The nav appears in every screen rather than being included
once, because each screen carries its own current-page state. `nav.html` is the canonical
copy: change it there first, then in each screen.

### Three class names that are not what you would guess

Name collisions inside one stylesheet are silent, so three classes are named defensively:

- **`.lrow`** — a phone list row (Drafts). NOT `.row`: `.row` is the desktop wrapping
  *form* row, which lives outside `@layer` and would win regardless of order.
- **`.prog`** — the determinate upload bar. NOT `.bar`: `.bar` is the desktop status bar.
- **`.polrow-touch`** — the two-line phone policy row, applied *with* `.polrow`.

And one that is easy to forget rather than easy to collide with: **`.seg-touch`**, applied
*with* `.seg` on every phone segmented control. The desktop segment is 24px tall, which on
a phone is a 24px tap target — half the minimum. `.seg-touch` takes it to 38px.

Also: Tailwind v4 cannot `@apply` a class that is itself declared in a layer, so
`.textarea` and `.select` repeat `.input`'s utilities rather than composing them, and
`.dialog` repeats `.popup`'s. Composing them silently fails the build.

---

## Tailwind v4 vs v3

The theme file is written for **v4** (CSS-first config, `@theme`). To use it:

```bash
npm i tailwindcss @tailwindcss/cli
npx @tailwindcss/cli -i lister-theme.css -o build.css --watch
```

For **v3**, move the `@theme` block into `tailwind.config.js` instead:

```js
// tailwind.config.js
module.exports = {
  content: ['./**/*.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#eceef2', panel: '#ffffff', 'panel-2': '#f5f6f9', sunken: '#f0f2f5',
        line: '#e3e6ec', 'line-strong': '#ccd2dc',
        ink: '#151922', 'ink-2': '#535c6b', 'ink-3': '#6f7887',
        accent: '#1b57c4', 'accent-hover': '#15459c', 'accent-weak': '#e7eefb',
        'accent-line': '#b9cdf3', 'on-accent': '#ffffff',
        ok: '#0f6b45', 'ok-weak': '#e4f4ec', 'ok-line': '#a9dcc3',
        bad: '#b4231c', 'bad-weak': '#fceceb', 'bad-line': '#f0b5b1',
        warn: '#8a5a00', 'warn-weak': '#fcf1dc', 'warn-line': '#e8c98a',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        cond: ['"IBM Plex Sans Condensed"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['9px', '12px'], xs: ['10px', '14px'], sm: ['11px', '15px'],
        base: ['12px', '16px'], md: ['13px', '18px'], lg: ['14px', '19px'],
        xl: ['15px', '20px'], '2xl': ['16px', '22px'], '3xl': ['18px', '24px'],
      },
      borderRadius: {
        chip: '5px', field: '6px', bar: '7px', panel: '8px', card: '10px', sheet: '16px',
      },
      spacing: {
        seg: '24px', 'ctl-sm': '26px', ctl: '30px', field: '32px',
        'ctl-lg': '36px', touch: '44px',
      },
      boxShadow: {
        ctl: '0 1px 2px rgb(18 22 30 / 0.10)',
        pop: '0 8px 24px rgb(16 22 34 / 0.14)',
        fab: '0 4px 12px rgb(20 32 60 / 0.22)',
      },
    },
  },
}
```

Keep the `.dark { … }` override block and the `@layer components` / container-query
sections from `lister-theme.css` as plain CSS — they work unchanged in v3.

**Dark mode is class-based and token-swapped.** There is not a single `dark:` variant in
the markup. `.dark` redefines the token values; every utility that references a token
flips on its own. Adding a new component needs no dark-mode work.

---

## What is NEW BEHAVIOUR, not just a new look

Everything below is a functional change. If you only restyle the existing app, these
will not happen by themselves.

### Layout and scrolling

1. **The form is two independent scroll panes.** Left (title, keywords, category, SKU,
   item specifics) and right (condition, description, pricing, toggles, shipping) scroll
   separately. Scrolling one must not move the other.
2. **The action bar never scrolls.** Analyze, Save/Update, and List on eBay sit in a
   fixed 52px bar. They are reachable at every scroll position, on both panes.
3. **Description has a fixed height with its own scrollbar** (148px). It no longer grows
   to fit its content. This is deliberate — an unbounded description is what pushed
   pricing and shipping off the screen.
4. **The photo library collapses,** to a 40px spine, and remembers the user's choice.
   Below **1500px** of app width it collapses *itself* until the user touches the
   control. At 1440 four open columns plus two form panes do not fit; the library is
   the one column you only need while attaching photos, so it is what gives.
5. **Layout reacts to container width, not device width** (CSS container queries on the
   app shell). Three tiers: ≥1600, <1600, <1500.
5a. **Nothing scrolls sideways, at any width.** Every row in a form pane wraps — fields
    drop to the next line rather than being pushed past the edge — and the panes clip
    horizontally as a backstop. A horizontal scrollbar anywhere is a bug.

### Item specifics

6. **"Additional" specifics are collapsed by default** — filled fields show, empty ones
   hide behind "Show all 30". The count ("12 filled · 18 empty") is live.
8. **The specifics grid changes column count** with width: 3-up wide, 2-up at laptop
   widths, 3-up again when the library auto-collapses and frees the space.

### Removed

7. **The group-level search over Additional specifics is cut.** There is no search box
   above the specifics grid. Each picker keeps its own internal search — that is a
   different control and is untouched.

10. **The Tier 1 keyword warning is cut.** No "2 Tier 1 keywords are not in your title"
    line. The app already fills Tier 1 into the title first, so the warning would only
    ever nag about a state that does not occur.

11. **Sold Comps is gone** from both desktop and phone — you told me the data isn't
    accurate. The eBay research button stays.
12. **Pricing is one row** (Format · Price · Quantity) rather than a vertical stack.
    This is what actually bought back the vertical space; deleting the comps panel on
    its own saved nothing, because the stack next to it set the row height.

### Theming

13. **Dark mode exists, and follows the device.** On first run the app takes the OS
    setting (`prefers-color-scheme`) and keeps tracking it as it changes. The moment
    the user hits the toggle in the nav rail, their choice is stored and the app stops
    following the device. Clearing the stored value returns it to following.

20. **The listing result is pinned, not scrolled.** Success and failure from List on
    eBay render in the status lane under the fixed action bar — or in the success
    popup — never inside a scrolling pane. A result posted into a scrolling column
    can be scrolled out of sight and missed. On success: the green lane bar with the
    item number and link, plus the success popup. On failure: the red lane bar with
    the eBay error, form untouched so the bad field can be fixed and resubmitted.
14. **Photo thumbnails do not theme.** They keep their own colours in both modes.

14a. **Three things need their own tokens, because the ordinary surface tokens invert
     badly.** In dark, a "sunken" fill reads as a hole rather than as a control:
     - `--track-off` / `--track-off-line` — an off toggle. Light `#e9ecef` / `#ccd2dc`,
       dark `#3b4553` / `#5c6674`: *lighter* than the panel, not darker. With the sunken
       fill, a toggle that was off was nearly invisible in dark.
     - `--ro` / `--ro-line` — a read-only field. Light `#f0f2f5` / `#dfe3ea`,
       dark `#222a34` / `#323c4a`, plus a lock glyph inside the field on the right.
       Item Origin otherwise looked editable in dark.
     - `--legend` — the keyword legend ink and the outlined swatch border. Light
       `#535c6b`, dark `#a9b1bd`. Swatches are 10px with a 1.5px border, and the legend
       text is 11px/500, not 10px/400.

### Navigation

15. ~~Photo Library gets a desktop nav entry.~~ **Superseded by 46.** The desktop rail
    carries no Library entry at all.
16. **The desktop nav is a rail with two states** (72px icons+labels, or 208px expanded
    with labels). No count badge on Drafts — fetching the draft list to render a number
    costs a request against a rate limit the app already hits.
46. **Library and Drafts are gone from the desktop rail.** The rail is now Home, Create
    Listing, Camera, Sourcing, Settings. The Photos | Drafts panel inside Create Listing
    already does both jobs in place, so a rail entry would only navigate away from the
    screen you are working on and cost a round trip back. The panel is the only route to
    either on desktop.
47. **The phone keeps both tabs.** Its bottom bar is unchanged: Library, Create, Camera
    (the raised button), Drafts, More. There is no room on a 390px screen for a panel
    that holds a photo library and a draft list beside a form, so on the phone they stay
    separate screens. The two platforms diverge here on purpose.
17. **The phone's Schedule toggle relabels the submit button** to
    "Schedule for <date>, <time>".

### Phone — Create Listing

55. **The action bar's buttons are labelled, not icon-only.** `Analyze` · `Update Draft`
    · `List on eBay`, all 44px tall. The save button keeps a `min-width: 106px` so the
    other two hold still as its label changes. Same three labels as desktop (51): **Save
    Draft** on a blank listing, **Update Draft** once it is a draft, **Saving…** in flight
    with the spinner and the off style. The **"Draft saved"** confirmation lands in the
    top lane — there is no room for a chip beside the SKU on a 390px header.

56. **Two status strips, one state each, carrying different things.**

    - **Top lane**, under the header: what the app just did to *the draft*. Its states are
      the style lookup, **"Analyzing photos…"**, **"Looking up style number 710671545…"**
      and **"Draft saved"**.
    - **Pinned strip**, above the action bar: anything about *listing* — the
      missing-fields hint and the eBay result. Same rule as desktop: a result is never
      inside a scrolling tab. Order: failure > success > in-progress > missing fields.

57. **Analyze reports two steps and no counts.** The app sends every photo in one request,
    so there is no per-photo progress to report: "Analyzing photos…", then "Looking up
    style number X…". No "6 of 8".

58. **The style-lookup banner has a dismiss ✕**, on phone and desktop. It is the only lane
    state worth clearing by hand; the others clear themselves.

59. **"Title, category, price and SKU are required to list" sits in the pinned strip**,
    amber, directly above the button it explains, and **List on eBay takes the disabled
    style while it shows**. Desktop keeps this in the action bar because there is room;
    the phone has none, and next to the blocked button is where it earns its place.

60. **The ••• menu holds New listing and Delete Draft. Nothing else.** Skip Draft sits
    under Draft Note on the Photos tab, where desktop puts it. Dark mode stays its own
    header button.

61. **The item-specific picker is a bottom sheet**, 74% tall, so the list starts under the
    thumb. Search-or-add at the top, 48px checkbox rows, a "Your own" tag on custom
    values, Done, and the limit line: **"6 selected · eBay allows up to 10 for this
    field."** The cap is eBay's, per field, and the app already has it. Styling only.

62. **Success is the pinned bar alone — there is no success popup on the phone.** The bar
    carries what the popup would have: the item photo, "Listed on eBay!", the item number
    and the promotion result, then three full-width-ish buttons — **View on eBay**,
    **Next draft**, **New listing**. One state, nothing to dismiss before acting.

63. **Failure reads "Failed:" and then eBay's message, unaltered.** The app's prefix, then
    eBay's words verbatim, wrapping rather than truncating. Nothing reworded, nothing
    appended, no Retry button.

64. **Next draft and Skip Draft both work on the phone.** Next draft is in the success
    bar; Skip Draft is under Draft Note. Queue work is not desktop-only.

65. **The blank listing on the phone follows the desktop rules exactly** (50, 52, 53): a
    dashed **"New · not saved"** chip in place of the SKU, both photo zones empty with a
    0 count, Keywords reduced to its one-line explanation, Category and Condition reading
    "Choose a…", the Specifics tab showing only *"Item specifics appear once a category is
    chosen"*, the AI note grey and without its unread dot, the top lane empty, and Skip
    Draft and Delete Draft replaced by "…appear once this is a draft — tap Save Draft to
    add it to the queue."

### The result lane — confirmed rules

27. **The lane grows, it never truncates.** Icon and actions hold their size; the message
    takes the remaining width and wraps. A long eBay error runs to two or three lines and
    the lane gets taller. No ellipsis, no clipping, on either device. (`.lane` is
    `align-items: flex-start`, `min-height: 36px`, `padding: 8px 16px`; the message is a
    `<p>` with `flex: 1 1 auto; min-width: 0`.) The same applies to the style-lookup
    banner, which shares the lane.

27a. **The lane prints the app's own message, verbatim.** Nothing is appended to it.
     "Nothing was posted or changed" belongs to the SKU and missing-field errors, which
     say it themselves; it is not a suffix the UI adds to every failure. An eBay publish
     rejection shows exactly what eBay returned.

28. **The only action button is "Change SKU", and only for SKU errors.** It does exactly
    one thing: move focus to the SKU field. It does not clear the field, generate a SKU,
    or resubmit. Every other error — eBay rejections included — gets dismiss only.

29. **A listing that went live is never red.** If the item posted but the promotion did
    not, the lane is amber, not red — the listing is on eBay either way, and red would
    send you looking for a listing that is already there. Two cases, both report-only
    with no action button, since the app has no promotion retry:
    - *Promotion failed* — the ad rate was rejected; the listing is live and unpromoted.
    - *No promotion campaign* — nothing to retry.
    Both keep the item number and the View on eBay link. Full success stays green.

30. **List on eBay shows progress on the button only:** spinner plus "Listing on eBay…".
    The lane is not involved — no step-by-step reporting, no form lock, because the app
    does neither.

30a. **Phone section tabs must fit the screen** — no horizontally scrolling tab strip.
     Labels are Photos / Details / Specifics / Price / Ship at 12px padding, which fits
     390px. "Pricing" and "Shipping" were shortened for exactly this reason.

30b. **The raised camera button must not overlap the action bar.** It sits 12px above the
     nav, and the action bar carries 22px of bottom padding so the List on eBay button
     clears it.

### Draft queue (new feature)

31. **The left panel gains a Photos / Drafts switch.** Photos is the existing library,
    unchanged. The switch is a segmented control at the top of the panel, beside the
    collapse chevron. When the panel is collapsed to its 40px spine, the two modes become
    stacked icon buttons with the active one highlighted, above a vertical label that
    reads the current mode and count ("Drafts · 12") — so the mode can still be changed
    and read at 40px.

32. **Draft rows carry no buttons.** Row = thumbnail (40px), title on one line truncated,
    and a status line: Ready (green dot), Processing (spinner, `--text-3`), Error (red
    dot, red text), plus a small grey "Skipped" pill where it applies. The whole row is
    the click target. A processing row is `opacity: .55`, `cursor: default`, and is not
    clickable — it has no handler at all, not a disabled one.

33. **Choosing a draft swaps the listing area only.** No page reload; the panel does not
    re-render and keeps its scroll position. The selected row stays highlighted
    (`accent-weak` fill, `accent-line` border) so the queue always shows where you are.

34. **Skip Draft** is a checkbox directly under Draft Note. It saves the instant it is
    ticked — a small green "Saved" chip confirms — and sticks until unticked. The draft
    keeps its place in the queue with the grey Skipped label and **still opens when you
    click it**. Skipping changes one thing only: Next draft passes over it.

35. **After a successful publish the draft is DELETED, not marked.** Listing on eBay
    removes the draft, and the list refreshes on publish, so its row disappears
    immediately and the count drops by one. There is no "Listed" or "Published" row
    state, and nothing stays highlighted in the panel.

    The published listing itself stays in the listing area with the pinned green success
    bar and a **Next draft** button. Only two things take you off it: Next draft, and New
    listing. Dismissing the success bar leaves the published listing on screen.

36. **Next draft = the oldest draft that is neither skipped nor still processing.**
    Error drafts are included — they are exactly the ones needing attention.

40. **The list is sorted oldest → newest.** That is not cosmetic: it makes Next draft
    the next row down, so the button and the list always agree about what comes next.

41. **Next draft refreshes the list before it chooses.** A draft that finished processing
    or was added since the last refresh is therefore eligible, and one that has since
    been claimed elsewhere is not.

42. **When nothing is left, Next draft lands on "You're all caught up 🎉"** — the same
    empty state as an empty queue, not a disabled button or a toast.

43. **The panel header reads "12 drafts"**, not "12 in queue".

44. **Collapsing the panel gives its width to the PHOTOS column, not the form.**
    Photo tiles are square (`aspect-square`, never a fixed height), so the column
    getting wider makes the thumbnails bigger rather than letterboxed — which is the
    point: collapse the panel to inspect a photo. The form column keeps exactly the
    width it had, so the title field and the specifics grid do not reflow.
    - ≥1600: photos 356 → 616, tiles ~73 → ~138.
    - 1500–1599: photos 304 → 520, tiles ~60 → ~114.
    - <1500: photos stays put and the form takes the space — at laptop widths the
      form is what needs it, and the panel is auto-collapsed there anyway.

44a. **Collapsed, the photos column never scrolls — at any window height.** The two
     photo zones (`.pzone`) share whatever height is left after the research buttons,
     the two notes and Skip Draft, and the grids (`.pgrid`) divide that between their
     rows. The tiles take the height available rather than forcing a square, so the
     column fits 940px and 1080px alike. The consequence: a collapsed tile is not
     guaranteed square (138 × 113 at 1920 × 1080), so real photos need
     `object-fit: cover`. That is the trade for never scrolling.

     This does NOT apply under 1500, where the column stays 300px — there the tiles
     stay square and the column scrolls as before, because stretching a 59px-wide
     tile to 102px tall is worse than a scrollbar.

48. **Delete Draft, with a confirm step.** A quiet red ghost button (`.btn-dq`) sits on
    the Skip Draft row, right-aligned, directly under Draft Note — draft-scoped controls
    stay together, and it is deliberately quieter than Update Draft and List on eBay so
    it is never the button you hit by reflex. It is never destructive on the first click:
    it only opens a confirm dialog.

    The dialog names what is being deleted (`SKU · title`), says "Deletes the draft and
    its photos from the queue. This can't be undone. Nothing on eBay changes.", and
    offers Cancel (focused on open) and a filled red **Delete Draft**. Escape and a
    backdrop click both cancel. Nothing is deleted until the second click.

    **After deleting**, the row goes and the next draft opens by the same rule Next draft
    uses — oldest, not skipped, not processing. If the deleted draft was the last one,
    the screen shows "You're all caught up 🎉". *Flagging this one: opening the next draft
    automatically is my choice, not something you specified. The alternative is to leave
    the form empty and wait for a click. Say which you want.*

49. **Opening an Error draft puts its message in the status lane.** The lane is the same
    strip under the header that the style lookup and the List on eBay result already use,
    so there is still only ever one status line on the screen. It carries the message
    stored on that draft **word for word** — nothing reworded, nothing appended — in
    `lane-bad`, and wraps rather than truncating. The header also shows a red **Error**
    chip beside the SKU in place of "Draft saved".

    **No action button in the lane.** There is no Retry and no Fix: the fields the error
    names are on screen already, a few inches away. The lane clears when that draft next
    saves or publishes successfully.

    Error drafts open normally at any time — only Processing drafts can't be opened. The
    row stays red in the queue until the next refresh, which, per 39, is manual.

50. **New listing, in the action bar beside the title.** A small secondary button,
    `+ New listing`, sitting after the SKU chip and the Draft saved badge behind a 1px
    divider — near the title, well away from Analyze Photos, Save Draft and List on eBay
    at the right end.

    It **clears the form and both photo zones** and deselects the row in the drafts list.
    What gets cleared is what the *item* owns: title, keywords, category, SKU, all item
    specifics, description, condition and condition description, price and the offer
    thresholds, package weight and dimensions, item origin, the AI note and the draft
    note. What survives is the account's defaults — quantity 1, Buy It Now, Allow Offers,
    Promote Listing and its ad rate, and the shipping, payment and return policies —
    because re-picking those on every listing is the opposite of the point.

    **It does not create or save a draft.** Nothing reaches the queue until Save Draft is
    clicked, exactly as today. The header says so: the SKU chip is replaced by a dashed
    `New listing · not saved` chip, and the completeness line reads "Title, category,
    price and SKU needed" in grey.

    It is also one of the two ways off a just-published listing (35), alongside Next
    draft.

    **With unsaved edits it opens the same Save / Discard / Cancel popup** that switching
    drafts uses (38) — one dialog, both ways out of an open draft. Save writes the draft
    and then clears; Discard clears without writing; Cancel stays put. With nothing
    changed, it clears straight away and asks nothing.

51. **The save button has three labels, one button:** "Save Draft" on a blank listing,
    "Update Draft" once it is a draft, and "Saving…" while the save is in flight —
    disabled, with the spinner, matching the app. Give it a fixed `min-width: 104px` so
    Analyze Photos and List on eBay beside it never shift as the label changes.

52. **Skip Draft and Delete Draft are hidden on a blank listing,** not disabled — there
    is no draft to skip or delete yet. In their place: "Skip Draft and Delete Draft
    appear once this is a draft — click Save Draft to add it to the queue."

53. **Item specifics do not exist until a category is chosen.** The field list and both
    counts come from eBay per category, so with no category picked there is nothing to
    draw. The Required and Additional grids are not rendered at all — no em-dash
    placeholders, no "0 filled · 30 empty", no "Show all 30" — and one line stands in
    their place: *"Item specifics appear once a category is chosen."*

    This keys off the **category**, not off being a new listing: an open draft with no
    category shows the same thing.

54. **The rest of the blank state is drawn, not left empty.** Both photo zones show only
    their Drop tile with a 0 count; Keywords reads "Keywords arrive with Analyze Photos,
    tiered by search weight" and drops its In title / In Theme legend; the Category
    caption is omitted; the AI Note loses its red treatment and its unread dot; and the
    style-lookup banner is absent entirely, because nothing has been looked up.

45. **`.lib.lib-closed` and `.lib.lib-auto` are deliberately two classes.** `.lib` is
    redeclared inside the container queries, which come later in the sheet; at equal
    specificity the later rule wins and collapsing is silently ignored below 1600px.
    This was a real bug. Do not "simplify" these selectors to one class.

37. **Empty queue shows only "You're all caught up 🎉"** in the listing area. No
    sub-heading, no button.

38. **Switching drafts with unsaved edits opens a small popup:** "Save changes?" with
    Save / Discard / Cancel. Cancel leaves you on the current draft.

39. **Refreshing is manual, always.** The drafts list refreshes on exactly four events:
    a save, a publish, clicking Next draft, and the Refresh button in the panel header.
    **There is no polling anywhere** — including for Processing drafts, which keep the
    spinner until one of those four refreshes tells them otherwise. Nothing in this
    panel is on a timer.

### Content rules the mockup now follows

21. **Title is in formula order:** brand, then fit/line, then item type, then department,
    size, colour, detail. The sample reads "Polo Ralph Lauren Classic Fit Mesh Polo Shirt
    Mens Large Navy Blue Pony Logo" — 76 of 80 characters. The field is two lines high so
    the whole thing stays visible at every width.

22. **Keyword chips are only the keywords added after Color** — never the brand and never
    the style name, both of which the title formula already places. Title Case; never a
    word the title carries on its own (no "Mens", "Navy", "Large"); no banned words (no
    "Cotton"); tiers fill in order. In the sample only "Pony Logo" made the title; Big
    Pony, Short Sleeve, Collared, Business Casual, Country Club and Ivy Style are Theme
    chips.

22a. **A chip never shrinks.** `flex-shrink: 0` and `white-space: nowrap`. Without both,
     a long chip in a flex row is squeezed below its text width and the label spills over
     the chip next to it — that was a real bug at every width.

22b. **The Theme item specific holds exactly the Theme chips,** comma-joined, in tier
     order: "Big Pony, Short Sleeve, Collared, Business Casual, Country Club, Ivy Style".
     It is a multi-value field and truncates with an ellipsis in the picker.

22c. **Every select shows a chevron.** `appearance: none` strips the native arrow, so each
     one is wrapped in a relative span with an inline chevron at `right: 9px`,
     `pointer-events: none`, 55% opacity. Without it a select reads as a plain text box.

23. **Condition options,** in this order: Pre-Owned - Excellent, New With Tags,
    New Without Tags, New With Defects, Pre-Owned - Good, Pre-Owned - Fair. Condition
    Description shows for the Pre-Owned grades.

24. **Item Origin is the country of manufacture** ("Sri Lanka"), read-only, on its own
    full-width row so it cannot clip.

25. **Category is a dropdown,** not a "Change" button into a picker. The option text is
    the readable tail of the path ("Men's Clothing > Shirts > Polos") with the parent
    path on a caption line beneath, so nothing is truncated at laptop widths.

26. **"View source" and "Clear all" are gone** — from the style-lookup banner and the
    Item Specifics header respectively.

### Camera — phone only

Restyle only: every control below already exists in the app. Behaviour changes are
called out explicitly; there are two, both marked.

68. **Camera leaves the desktop rail.** It is a phone screen, and a desktop entry would
    open something the machine cannot do. The rail is now Home, Create Listing, Sourcing,
    Settings — updated on every desktop screen. *Flagging: your note said the rail is
    "Create, Sourcing and Settings". I kept Home, since you only asked to remove Camera.
    Say the word and it goes too.*

69. **Both camera steps are full screen with no nav bar**, as the brief requires — Review
    included, since it is part of the camera flow. Retake is the way back.

70. **The capture chrome stays dark in both themes.** It sits over a live viewfinder,
    where a light surface would wash out the picture and stop being readable at the same
    time. Review is an ordinary app surface and follows the theme normally.

71. **Capture, top to bottom:** a 56px bar with close ✕, the photo count and flash;
    a **square viewfinder** at the full 390px width — measured 390 × 390 — with the
    3×3 grid, the focus reticle and a "Tap to focus" tag; ISO and Shutter rows, each a
    slider plus an Auto pill; white balance as Auto / Indoor / Cool / Daylight / Cloudy;
    the thumbnail strip with a remove ✕ per shot; and the shutter row — flip camera,
    the 72px shutter, Done (n).

    *Layout note, not a behaviour change:* **zoom 1x / 2x / 3x is overlaid on the
    viewfinder**, bottom centre, rather than given its own row — where every phone camera
    puts it, and it buys back a row of height. Same three values, same behaviour.

    A square viewfinder can only be 390 tall at this width, so roughly 120px is always
    left over. It is spread evenly through the control stack, which keeps every control
    in the lower two thirds and within thumb reach.

72. **A 3×3 framing grid is always on** — thin white lines at 20% opacity across the
    viewfinder, no toggle. It is drawn over the preview and is **never part of the
    captured photo**.

73. **The placeholder item and the focus square are centred** in the viewfinder.

74. **ISO and Shutter always render here.** The app already hides them on a phone that
    cannot do manual exposure, and the design does not second-guess that or add any
    separate exposure control. Auto is shown as a pressed pill *and* a dimmed slider, so
    the two halves of one control never disagree.

75. **The thumbnail strip swipes, with no scrollbar at all** — no bar, no arrows, on any
    engine (`scrollbar-width: none`, `-ms-overflow-style: none`, and a zero-size
    `::-webkit-scrollbar`). Scrolling by touch is unaffected.

76. **The torch is a plain on/off, starting Off.** It is the phone's torch, not a camera
    flash — a web app cannot fire one on the shutter, so there is no Auto state and no
    third position. Off carries a slash through the bolt, so the state reads without
    depending on colour, and the button is `aria-pressed` rather than relying on the icon
    alone. It starts Off because constant light on fabric blows out highlights and shifts
    colour, which is the kind of photo that gets a return opened.

77. **NOTHING ON THE CAPTURE SCREEN MOVES WHEN THE FIRST PHOTO IS TAKEN.** The strip keeps
    its 64px whether or not it holds anything — rendered empty, never removed. This is
    load-bearing: when the layout shifted on the first shot, people re-aimed between shots
    and the perspective changed from photo to photo. Verified by measurement: every
    control sits at an identical y with 0 photos and with 9.

    The empty state otherwise reads "0 photos" and a **"Done"** button with no count.

78. **Review:** header of ← Back, "Review (n photos)" and an "n for AI" chip; one line of
    help; a 3-column grid where each cell carries the blue check for AI selection, a
    `#n` badge and a delete ✕; then AI Note and Draft Note buttons — green with a check
    when filled — and **Create Draft (n photos, k AI)**, which becomes "Uploading i/n…"
    with a progress bar. Both counts recount live as you tap, which the app already does.

79. **The note editor is one popup serving both notes.** Heading, placeholder and footnote
    change; nothing else does. Red ✕ discards, green ✓ saves — the app's own two buttons.

**Behaviour change in this screen — one:**

80. **"← Retake" becomes "← Back", and it no longer discards anything.** It returns to the
    viewfinder keeping every photo, every AI selection and both notes; new shots are added
    to the end of the strip. Starting fresh is the close ✕, or removing photos one at a
    time. The old label promised destruction and the new one does not, so the warning that
    used to belong with it goes too.

68b. **A `<dc-import>` passes every attribute as a STRING.** `shots="0"` arrives as
    `"0"`, not `0`, so a `typeof props.x === 'number'` guard silently falls through to the
    default — which is exactly how the "Nothing shot yet" frame ended up rendering nine
    photos. Coerce numeric and boolean props on the way in, and treat only `undefined`,
    `null` or `""` as "use the default". The same trap makes `manual="false"` truthy.

### Drafts — phone

The phone keeps its own Drafts screen; desktop does the same job in the Photos | Drafts
panel (46). Everything the current page has is carried over, and nothing is added.

81. **The row is two buttons side by side, not one inside another.** HTML forbids a nested
    button, and a delete target inside a tappable row gets swallowed by it. So the row
    body is one `<button>` that opens the draft and delete is a sibling `<button>` beside
    it — measured 44 × 76, comfortably past the 44px touch minimum.

82. **Row contents:** a 56px thumbnail, the title on one line with an ellipsis, then a
    second line carrying the status pill, if any, and **condition · Created <date>**. The
    date is the creation date on every row, Processing and Error included — the list is
    sorted by it, so a row without one cannot be placed in it.

82a. **The date never truncates; the condition gives way first.** They are two elements,
    not one string: the condition shrinks and ellipses, the date is `flex-shrink: 0`.
    "Pre-Owned —… · Created 15 Sep" still places the row in the list; "Created 1…" does
    not. Verified across every row, including the Skipped ones where the pill takes the
    width.

83. **Processing rows carry a spinner pill, are dimmed to 55%, and have no handler bound
    at all** — not a disabled handler, none. Same as desktop.

84. **An Error row keeps its date and puts the message on a line of its own.** Second
    line: the red **Error** pill and the creation date. Third line: the message, wrapping
    to two lines rather than truncating — it is the thing you opened the list to read, and
    "Analysis failed: AI service…" tells you nothing. Error rows run 97px against the
    usual 77px; nothing else changes size.

84a. **An Error on a draft always comes from background processing failing — the AI step
    or the photo upload. Never from an eBay publish.** A publish failure belongs to the
    List on eBay *result* (28–30) and never becomes a draft's stored state. Sample message:
    "Analysis failed: AI service overloaded, try again". *This corrects the desktop too —
    the Error-draft lane on Create Listing and the Draft queue board had been showing a
    publish error, which that state can never hold.*

85. **Skipped rows carry the same small grey "Skipped" pill as desktop**, before the
    condition and date.

86. **Delete uses the app's confirm, verbatim:** "Delete this draft?" / "This cannot be
    undone." with Cancel and Delete side by side as equal-width targets.

87. **Header:** "Drafts", the live count, and Refresh. No search, no filter, no sort
    control, no select mode — none of those exist on the page today.

88. **Empty state:** "No drafts yet" and a Create Listing button, with the count reading
    "0 drafts".

**Behaviour changes — two:**

89. **Sorted oldest → newest by creation**, matching the desktop queue, so "next" means
    the same thing on both.

90. **No auto-refresh.** The list refreshes when the page opens and when Refresh is
    tapped. Never on a timer — the same rule as desktop (39), for the same reason: the
    draft list costs a request against a rate limit the app already hits.

### Photo Library — phone

93. **Four tiles across at 91px.** The grid is the page, so it takes the width and every
    other row of chrome stays on one line — roughly 28 photos visible before scrolling,
    about 20 with a selection open.

94. **Folder tabs** All / Shannon / Aaron as the segmented control used everywhere else.

95. **Upload has two entry points and one progress report.** The Upload button in the
    header, and the dashed **Add** tile as the first cell of the grid — that tile is the
    drop area, a tap target on a phone and a drag target in a desktop browser. Progress is
    a single strip under the folder tabs: spinner, **"Uploading 4/12…"**, and a bar.
    **No Cancel** — an upload in flight cannot be stopped.

95a. **No photo total in the header.** The app loads in batches and never knows one, so
    it cannot honestly show a count.

96. **Grid tiles:** tap to select (blue ring plus a check), an amber note badge on photos
    that carry one, double-tap to open the lightbox. **Load older photos** sits at the
    end of the grid.

97. **Selecting raises three short rows above the nav, not one crowded one.**

    - `n selected` with **Clear**
    - **Delete (n)** · **Note** · the two move targets
    - **Send to**: **eBay Listing** · **AI Analysis**

    The order is deliberate: the pair you reach for most — where the photos are going —
    sits lowest, nearest the thumb, and the destructive one is furthest from it.

98. **Move offers the two folders you are NOT in.** In All: Shannon and Aaron. In Shannon:
    All and Aaron. In Aaron: All and Shannon. Moving a photo into the folder it is already
    in is not an action.

99. **Each Send to button fills as its own photos go across.** Progress is on the control
    you tapped; nothing else on the screen reports it. **The selection clears at the moment
    the check appears** — the tiles let go immediately, and only the button holds the check,
    for about a second. Because there is no longer a selection to act on, the count row and
    the Delete / Note / move row go with it; the Send to row is the last thing on screen
    before the whole bar does.

100. **Note takes exactly one photo**, as it does today — **visibly greyed** at any other
    count (sunken fill, muted border and label, default cursor), and the popup is titled
    "Note on IMG_4813". A note belongs to a photo;
    applying one across a selection would silently overwrite notes you cannot see from
    here.

    Its help text says what the note is for and, more importantly, what it is not:
    *"A reminder on this photo. Shows as a badge and in the enlarged view. Not sent to
    eBay or the AI."* Only the AI Note on Create Listing reaches the AI.

101. **Delete** confirms with "Delete n photos? This cannot be undone."

102. **Empty state:** "No photos yet", a line naming the two ways in (camera or upload),
    and an Upload photos button.

102a. **The grid scrolls clear of the raised camera button.** That button overhangs the
    nav bar by about 16px, straight over the end of the grid, so the scroll area carries
    58px of bottom padding — enough for the last row and "Load older photos" to come out
    from under it. Verified: the button's bottom clears the camera's top at full scroll.

**Small additions — two, both in the lightbox:**

103. **Previous / next**, by swipe on the phone and by two 44px on-screen arrows so it is
    discoverable and reachable one-handed. **No position counter** — same reason as 95a:
    with batch loading there is no total to count against.

104. **The file name and the photo's note are both kept** in the lightbox: the name top
    right, the note along the bottom.

**Behaviour changes — none.** Every control exists on the page today; only the
arrangement is new. Two placements worth confirming: the drop area doubles as the first
grid tile, and send progress lives on the send buttons rather than in a separate line.

### Sourcing comes out of the navigation

105. **Sourcing is unlinked, not removed.** The page stays in the app; nothing navigates
    to it. Gone from the desktop rail and the phone More sheet on every screen.

106. **There is no Home screen at all.** The logo and the site's front page both go
    straight to Create Listing. The desktop rail is the logo, Create Listing and Settings;
    the phone More sheet is Settings and dark mode.

### Settings — desktop and phone

107. **Three sections, and the section list never goes away:** Categories, Policies, eBay
    Account. Desktop puts them in a 236px column beside the content; phone puts them in a
    segmented control under the header. **The eBay connection happens inside the Account
    section, not on a screen that replaces it** — the thing it does today.

108. **Categories: one button, and it says Search.** The field plus **Search**, which
    reads **"Searching…"** with a spinner and the disabled style while it works. Results
    land under the field and **tapping a result adds that category** — there is no separate
    Add step. A line under the list says so. Then the saved categories as cards. A card shows the full path, the eBay
    category id, and a line reading "30 item specifics, 6 allow more than one value".
    Expanding it reveals every item specific with a checkbox marking the ones eBay lets
    you give more than one value — four columns on desktop, two on the phone. Remove sits
    on the card header.

109. **Policies:** three groups, each a card with its name, a count, and **+ Add**. A row
    is the default star, the label, the policy id and Remove.

    **On the phone that row was the cramped one, and it is now two lines.** A single line
    could not hold a star, a 20-character id, a long label and a Remove at 44px each. The
    label sits over the id, with the star and Remove as full-height 44px targets down
    either side. Desktop keeps one line, where there is width for it.

    The star is a real toggle button, not a decorative glyph: exactly one policy per group
    is the default and you set it by pressing its star.

110. **eBay Account:** the three steps as a numbered list — Authorize with eBay, Exchange
    the code, Copy the refresh token — each with its own control, and each numbered marker
    showing done / current / pending. Steps you have not reached keep their controls
    visible but disabled, so the whole shape of the job is legible before you start.
    Once connected, a green band names the account above the steps.

111. **Every Remove confirms:** "Remove this? It goes from Settings only. Listings already
    using it are untouched."

**Behaviour changes — one:**

112. **The eBay connection keeps the Settings navigation.** Today it takes over and you
    lose your way back; here it is a section like the other two, so Categories and
    Policies stay one click away throughout. Nothing about the three steps themselves
    changes.

### Dark mode has one home per platform

91. **On the phone, dark mode lives in the More sheet and nowhere else.** The moon that
    was in the Create Listing header is gone; no other phone screen carries one. On
    desktop it stays in the rail. Two toggles for one setting is how they drift apart.

92. **The first build follows the device setting; the toggle comes later.** Entry 13's
    rule still describes the end state — follow the OS until the user chooses, then
    remember their choice — but nothing has to ship a control on day one.

113. **The navigation board shows the labelled phone action bar** — Analyze · Update
    Draft · List on eBay — matching entry 55. It had been left on the icon-only pair that
    55 replaced.

### Two authoring rules the mockup learned the hard way

These are about the Design canvas, not about the app — but they cost a version, so
they are written down.

66. **Never put a `{{hole}}` inside a `<textarea>`.** The canvas runtime is React, and a
    textarea's value cannot come from a child node — the hole stringifies and the field
    renders `[object Object]`. Title, AI Note, Condition Description and Description all
    hit this. The fix is two literal-content textareas behind `sc-if`, one filled and one
    empty, rather than one textarea with a hole. Inputs are unaffected: `value="{{x}}"` is
    an attribute, not a child, so it works.

67. **HTML entities do not belong in values returned from `renderVals()`.** A hole renders
    as a *text node*, so `Men&#39;s Clothing &gt; Shirts` prints those entities literally
    instead of `Men's Clothing > Shirts`. Use the real characters — and then mind the
    JavaScript quoting, because an apostrophe inside a single-quoted string ends it.
    Entities in ordinary markup are fine; it is only values crossing through a hole that
    must be plain text.

### Static in the mockup only — the app already does these

No new logic here. The mockup draws these as flat elements because it is a styling
reference; the existing implementations carry over unchanged. Numbering is kept
stable, so these keep the numbers they were first reviewed under.

9. **Keyword chips by tier.** The tiering and the in-title / in-Theme states already
   exist — only the styling changes. Tier label: Condensed 10px, uppercase,
   `tracking-[0.09em]`, `ink-3`, in a fixed 48px column, top-aligned with 5px of
   padding so it sits on the first chip row. Chips: 24px tall, fully rounded,
   0 9px padding, 11px/500 text, 5px gap within a row, 6px between tier rows.
   *In title* — `accent` fill, `accent` border, `on-accent` text. *In Theme* —
   transparent fill, `line-strong` border, `ink` text, plus a "Theme" tag in
   Condensed 8px uppercase `ink-3`, 5px after the label. Legend above the rows:
   9px rounded swatch (filled `accent`, and outlined `line-strong`) with 10px
   `ink-3` text.

18. **Item-specific pickers.** All 39 render as static buttons. The app's existing
    picker already does search, single and multi-select, and custom values — keep it.
    What changes is only its appearance: 32px tall, 6px radius, `line-strong` border,
    12px value text, `ink-3` and an em dash when empty, chevron at 60% opacity. A
    multi-value field shows its values comma-joined on one line and truncates.
19. **Photo selection, drag-to-zone, reorder, and the lightbox.** Drawn, not wired.
    Existing behaviour carries over; see the States artboard for the lightbox styling.
