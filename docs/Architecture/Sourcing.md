# Sourcing

Tracks the **buy side**: which stores actually produce. Fully separate from listing, AI and eBay. See [[Overview]].

> **Redesign (2026-09-17):** taken out of the menu for now and not redesigned. The page and all data stay; open it at `/sourcing`. See [[Decision Log]].

## Data
One raw JSON file in Cloudinary, `ebay-listings/config/sourcing`, loaded and saved all at once:
- **stores:** id, name, address, lat, lng, createdAt
- **trips:** id, storeId, date, bb (Bread & Butter), medium, high, createdAt

Code: `src/lib/sourcing.js`, `/api/sourcing`, `src/app/sourcing/page.js`, `src/components/SourcingMap.js`.

⚠️ No backup or undo yet. See [[Open Issues]] #4.

## Features
- **Log Trip** (entered after the trip): the store must be chosen (no default), date, and three tier counts with ▲/▼ steppers. Blank or 0 = a miss. On mobile the tiers stack large; desktop stays 3 across.
- **Stores:** add/edit/delete name + address. Editing the address clears the coordinates so the store re-geocodes.
- **List view:** ranked by average items per visit. Each card shows total items, visits, items/visit, and tier counts with percentages. Tap a card to see its trips (each deletable) and a pre-selected "Log a trip to X."
- **Map view:** Leaflet + OpenStreetMap tiles.
  - Pins: 🟢 > 7 per visit · 🟡 4–7 · 🔴 < 4 · ⚪ no visits
  - Tap a pin to see name, total items, visits, items/visit.
  - "Locate on map" for stores without coordinates; "Re-locate all pins" re-geocodes everyone.
  - Modals use z-index 1100 so they sit above the map.

## Geocoding
Runs server-side when saving, for any store with an address but no coordinates:
1. **Google Geocoding** (env var `GOOGLE_CLOUD_API_KEY`, in Vercel and `.env.local`): accurate, house-level.
2. Fallback **Nominatim** (free), then a retry with unit/suite text stripped ("138th St B" → "138th St").

Nominatim is only street-level for many suburban addresses, which misplaced pins before Google was added.

## Navigation
Desktop: Sourcing tab. Mobile: More → Sourcing.
