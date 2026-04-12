# eBay Listing App — Gen 2 Plan

## Mission
AI-powered eBay listing tool that takes listing time from 3 minutes to seconds. Built for two users (husband and wife) processing 200-400 listings per month.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js (React) | Pages, UI components, responsive design |
| Hosting | Vercel | Deployment, serverless API routes |
| AI | Anthropic Claude (Opus) | Photo analysis, field generation |
| Images | Cloudinary | Photo storage, resizing, management |
| Listings | eBay Inventory API (REST) | Create inventory items + offers |
| Promotions | eBay Marketing API (REST) | Promoted listings |
| Pricing | eBay Browse API (REST) | Sold comps for suggested pricing |
| Auth | eBay OAuth 2.0 | Token management, auto-refresh |
| Source Control | GitHub | Version control |

---

## Environment Variables

```
ANTHROPIC_API_KEY          — Claude API key
EBAY_CLIENT_ID             — eBay app Client ID (production)
EBAY_CLIENT_SECRET         — eBay app Client Secret (production)
EBAY_DEV_ID                — eBay Developer ID
EBAY_OAUTH_REFRESH_TOKEN   — OAuth refresh token (for auto-renewing access tokens)
EBAY_RUNAME                — eBay OAuth RuName (redirect URI)
CLOUDINARY_CLOUD_NAME      — Cloudinary cloud name
CLOUDINARY_API_KEY         — Cloudinary API key
CLOUDINARY_API_SECRET      — Cloudinary API secret
EBAY_SANDBOX               — "true" for sandbox mode (optional)
```

Note: Gen 2 uses OAuth 2.0 with refresh tokens instead of Auth-n-Auth. No more manual token renewal.

---

## Pages

### Page 1: Photo Library

The central hub for all photos. This is where every photo lives before it becomes a listing.

**Layout:**
- Top bar with folder tabs: "All Photos" | "Shannon" | "Aaron"
- Upload button (drag-and-drop zone + file picker)
- Grid view of photos (thumbnails)
- Action bar: Delete Selected | Add Note

**Features:**
- **Upload:** Drag-and-drop or file picker. On upload, photos are automatically resized to 1600x1600 at 75% quality before storing in Cloudinary.
- **Folders:** Three views — All Photos, and one folder per user. Photos are assigned to a folder when dragged in. This prevents duplicate listings when both users work simultaneously.
- **Selection:** Click to select one photo, Ctrl/Cmd+click or shift+click for multi-select. Selected photos get a visual highlight/checkmark.
- **Delete:** Select photos, click delete, confirm. Removes from Cloudinary.
- **Notes:** Select a photo, then click "Add Note" in the action bar to add/edit a text note (e.g., "measured 29x30, tag says 32x32"). No icons on thumbnails — keeps the grid clean. Notes are stored as metadata in Cloudinary or in a simple database.
- **Drag to Generation Page:** Selected photos can be dragged into either zone on the Generation Page. This is how you move photos from the library to a listing.

**Photo Organization:**
- Photos in "All Photos" are unassigned — available for either user to claim
- Dragging a photo into "Shannon" or "Aaron" claims it
- Once a listing is created from those photos, they can be archived or deleted

---

### Page 2: Generation Page (Listing Creator)

The main workspace where AI analyzes photos and generates listing details.

**Layout — Two Zones at the Top:**

#### Zone 1: AI Analysis Photos
- Accepts up to 8 photos
- Drag-and-drop from Photo Library, file picker, or drag-to-reorder within the zone
- Photos are compressed to 800px at 75% quality before sending to Claude
- These photos are what the AI "sees" to generate the listing
- "Analyze" button triggers AI processing

#### Zone 2: eBay Listing Photos
- Accepts photos in order (first photo = eBay main/hero image)
- Drag-and-drop from Photo Library, file picker, or drag-to-reorder
- Full quality photos (as stored in Cloudinary at 1600x1600)
- These are the photos that get uploaded to eBay with the listing

**Layout — Form Below the Zones:**

After the AI analyzes the photos, the form populates with generated data. Every field is editable by the user before submitting.

#### AI-Generated Fields:

| Field | How It Works |
|-------|-------------|
| **Title** | Up to 80 characters. Structure: [NWT if applicable] Brand \| Product Name \| Type \| Gender \| Size \| Color \| Key Details. If pre-owned, no "New With Tags." Pants sizing rule: if measured size differs from tag by 2+ inches, use measured size in title. |
| **Category** | AI selects the correct eBay category from eBay's taxonomy. The app fetches category suggestions from eBay's API to assist. |
| **Item Specifics** | Fetched from eBay API based on the selected category. Each specific is displayed as the correct input type (dropdown, text, etc.). If eBay provides a dropdown, our UI shows a dropdown with only eBay's options. AI can select multiple values from a single dropdown if applicable. |
| **Condition** | Uses eBay's current condition values (New With Tags, New Without Tags, Pre-Owned, etc.) |
| **Condition Description** | Pre-owned items get a description template. NWT items left blank. Templates vary by item type (future enhancement). |
| **Suggested Price** | Pulled from eBay Browse API — actual sold comps. Display the recent sold prices so the user can see the data and make the final call, not just a single AI guess. |
| **Country of Manufacture** | AI determines from labels/tags in photos |

#### User/Manual Fields (with defaults):

| Field | Default | Notes |
|-------|---------|-------|
| **Listing Type** | Fixed Price | Toggle: Fixed Price or Auction |
| **Price** | From suggested price | User sets final price |
| **Quantity** | 1 | Editable |
| **SKU** | Blank | User enters if needed |
| **Shipping Policy** | Pre-set policy number | Uses eBay shipping policy ID |
| **Best Offer** | Off | Toggle on/off + minimum offer field |
| **Scheduled Listing** | None | Date/time picker for future listing |
| **Promoted Listing** | On, 5% | Always on by default. Ad rate adjustable. |

#### Action Buttons:
- **"List on eBay"** — Creates inventory item, creates offer, publishes offer, applies promotion. One click.
- **"Save Draft"** — Saves the listing locally without publishing (for coming back later)
- **"Clear"** — Resets the form for the next item

---

## Pricing — Sold Comps Approach (Fixing Gen 1's Problem)

Gen 1's pricing was unreliable because the AI was guessing. Gen 2 takes a different approach:

1. After AI identifies the item (brand, product, size, etc.), the app queries eBay's Browse API for recently sold items matching those keywords.
2. The app displays a **Sold Comps panel** showing:
   - Last 5-10 sold prices for similar items
   - Average sold price
   - Price range (low to high)
3. The AI suggests a price based on this real data, but the user sees the comps and makes the final call.
4. This is transparent — you can see WHY a price is suggested, not just a number.

---

## eBay API Flow (REST — New Approach)

### Listing an Item (Behind the Scenes):

```
Step 1: Create Inventory Item (Inventory API)
   → POST /sell/inventory/v1/inventory_item/{SKU}
   → Includes: title, description, item specifics, condition, images, category

Step 2: Create Offer (Inventory API)
   → POST /sell/inventory/v1/offer
   → Includes: price, quantity, listing type, shipping policy, listing schedule

Step 3: Publish Offer (Inventory API)
   → POST /sell/inventory/v1/offer/{offerId}/publish
   → Makes the listing live on eBay (or schedules it)

Step 4: Apply Promotion (Marketing API)
   → Adds the listing to a promoted listings campaign at the specified ad rate
```

From the user's perspective, this is all one "List on eBay" button click.

### Getting Item Specifics:

```
→ GET /sell/metadata/v1/marketplace/{marketplace_id}/get_item_aspects_for_category
→ Returns all required/optional item specifics for that category
→ Includes: field name, data type, allowed values (for dropdowns), whether multi-select is allowed
```

### Getting Sold Comps:

```
→ GET /buy/browse/v1/item_summary/search
→ Filter: sold items, matching keywords, recent timeframe
→ Returns: sold prices, dates, item details
```

### OAuth 2.0 Token Management:

```
→ App stores a refresh token (long-lived)
→ Before each API call, checks if access token is expired
→ If expired, uses refresh token to get a new access token automatically
→ No more manual token renewal
```

---

## Business Rules

1. **Pants 2-Inch Rule:** If the measured waist or inseam differs from the tag size by 2 or more inches, the title uses the measured size. Both tag size and measured size are noted in the description.

2. **Promoted Listing Default:** Always on at 5%. Adjustable per listing.

3. **Condition Templates:**
   - New With Tags → condition description left blank
   - Pre-Owned → uses a pre-written template (item-type-specific templates are a future enhancement)

4. **Photo Quality:**
   - Library storage: 1600x1600 @ 75% quality
   - AI analysis: 800px @ 75% quality
   - eBay listing: full quality from Cloudinary (1600x1600)

---

## Build Phases

### Phase 1: Foundation
- Set up Next.js project with clean folder structure
- Configure Vercel deployment
- Set up all environment variables
- Implement eBay OAuth 2.0 token management (refresh flow)
- Connect to Cloudinary API
- Basic page routing (Photo Library + Generation Page)
- Clean, modern UI shell (navigation, layout, responsive design)

### Phase 2: Photo Library
- Photo upload with drag-and-drop + file picker
- Auto-resize to 1600x1600 @ 75% on upload
- Grid view with thumbnails
- Folder system (All / User 1 / User 2)
- Click and multi-select
- Delete selected photos
- Add/edit notes on photos

### Phase 3: Generation Page — Photo Zones
- AI Analysis Zone (max 8 photos, compressed to 800px)
- eBay Listing Photo Zone (ordered, first = main photo)
- Drag-and-drop into zones from Photo Library
- File picker for each zone
- Drag-to-reorder within each zone
- Remove individual photos from zones

### Phase 4: AI Analysis + Form
- Connect Claude API for photo analysis
- Build the prompt that generates: title, category, condition, item specifics, country of manufacture
- Dynamic item specifics form (fetched from eBay per category)
- Dropdowns mirror eBay's allowed values with multi-select
- All fields editable by user
- Sold comps panel using Browse API
- AI-suggested price based on real comp data

### Phase 5: Listing Submission
- "List on eBay" flow: inventory item → offer → publish → promote
- Shipping policy by eBay policy number
- Best offer toggle + minimum
- Scheduled listing date/time
- Promoted listing default (5%, adjustable)
- Quantity and SKU fields
- Success/error feedback

### Phase 6: Polish + Mobile
- Responsive design for mobile phone use
- Performance optimization
- Error handling and edge cases
- Testing with sandbox mode
- Final UI polish

---

## What We Are NOT Building (Scope Guard)

To avoid Gen 1's problem of feature creep, these items are explicitly out of scope for Gen 2's initial release:

- Multi-platform support (Poshmark, etc.) — future consideration
- Item-type-specific description templates — future enhancement
- Separate user login/authentication — using folder system instead
- Batch/bulk listing mode — one item at a time for now
- Sales tracking or analytics
- Inventory management beyond listing creation

If we want to add any of these later, we plan it first, then build it.

---

## File Structure (Planned)

```
ebay-listing-app/
├── app/                        — Next.js App Router pages
│   ├── layout.js               — Root layout (nav, theme)
│   ├── page.js                 — Home / redirect
│   ├── library/
│   │   └── page.js             — Photo Library page
│   └── generate/
│       └── page.js             — Generation / Listing Creator page
├── components/                 — Reusable UI components
│   ├── PhotoGrid.js            — Photo grid display
│   ├── PhotoZone.js            — Drag-and-drop photo zone
│   ├── ItemSpecificsForm.js    — Dynamic eBay item specifics
│   ├── SoldComps.js            — Pricing comps panel
│   └── ...
├── lib/                        — Shared utilities
│   ├── ebay.js                 — eBay API client (OAuth, Inventory, Browse, Marketing)
│   ├── cloudinary.js           — Cloudinary upload/resize/manage
│   ├── claude.js               — Anthropic API client
│   └── constants.js            — Defaults (promo rate, shipping policy, etc.)
├── api/                        — Next.js API routes (serverless)
│   ├── ebay/
│   │   ├── token.js            — OAuth token refresh
│   │   ├── list.js             — Create inventory item + offer + publish
│   │   ├── specifics.js        — Get item specifics for category
│   │   ├── comps.js            — Sold comps search
│   │   └── promote.js          — Apply promoted listing
│   ├── cloudinary/
│   │   ├── upload.js           — Upload + resize photos
│   │   ├── list.js             — List photos (by folder)
│   │   ├── delete.js           — Delete photos
│   │   └── note.js             — Add/edit photo notes
│   └── generate.js             — Claude AI analysis endpoint
├── public/                     — Static assets
├── .env.local                  — Local environment variables
├── vercel.json                 — Vercel config
├── package.json
└── CLAUDE.md                   — Instructions for Claude Code
```

---

## Summary

This plan is the blueprint. Every feature, every page, every API call is documented here. When we start building, we follow this plan phase by phase. If we want to change something, we update the plan first, then build. No more ad hoc changes.
