# Overview

AI-powered eBay listing tool for Aaron and Shannon (husband/wife resellers, 200–400 listings/month). See [[Home]].

## Stack
- **Next.js (App Router)** on **Vercel**. Push to `main` deploys.
- **Claude** (Sonnet) for photo analysis and item specifics. See [[AI Pipeline]].
- **Cloudinary** (free plan) for photos, drafts, settings and sourcing data. See [[Photos and Cloudinary]].
- **eBay REST APIs:** Inventory, Media, Metadata, Taxonomy, Browse, Marketing, via OAuth refresh token.
- **Brave Search** for style-name lookup; **Google Geocoding** for sourcing pins.

## Pages
| Page | What it does |
|---|---|
| `/generate` (Create Listing) | Drag photos in, AI Note / Draft Note boxes, Google Lens + eBay research buttons, Analyze, listing form, publish |
| `/camera` | Shoot photos, review, pick AI photos, notes, Create Draft (runs in background) |
| `/drafts` | Draft list with processing/error states; opens a draft in `/generate` |
| `/library` | Photo library with folders (All Photos / Shannon / Aaron), "Load older photos" |
| `/sourcing` | Store/trip tracker, list and map views. See [[Sourcing]] |
| `/settings` | Categories, business policies |

Navigation: desktop top bar (Create Listing, Camera, Drafts, Sourcing, Settings). Mobile bottom bar: Library, Create, Camera, Drafts, More (More opens Sourcing + Settings).

## Where the logic lives (`src/lib`)
| File | Role |
|---|---|
| `listingPipeline.js` | Claude calls (vision, specifics, refine), category lookup, specifics + condition fetch, `[COST]` logging |
| `titleRules.js` | The title formula shared by all prompts |
| `descriptionTemplate.js` | Description body + 2-inch rule |
| `conditions.js` | Single source of truth for conditions and eBay condition IDs |
| `ebay.js` | OAuth tokens, EPS photo upload |
| `cloudinary.js` | Photo upload/delete |
| `drafts.js` | Draft save/load/list (raw JSON in Cloudinary) |
| `sourcing.js` | Sourcing data + geocoding |
| `constants.js` | eBay hosts, defaults, library folders |

## Key API routes
- `/api/generate`, `/api/generate/specifics`, `/api/generate/refine`: manual AI flow
- `/api/drafts/process`: camera background pipeline. See [[Drafts and Camera Flow]].
- `/api/ebay/list`: publish. See [[Publishing to eBay]].
- `/api/ebay/specifics`: item specifics + allowed condition IDs for a category
- `/api/ebay/sku-inspect?sku=`: read-only look at what eBay holds for a SKU
- `/api/ebay/comps`: sold comps
- `/api/sourcing`: stores/trips load and save
