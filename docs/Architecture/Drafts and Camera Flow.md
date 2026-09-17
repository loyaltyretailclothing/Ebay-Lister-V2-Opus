# Drafts and Camera Flow

See [[Overview]], [[AI Pipeline]].

## Storage
Each draft is a raw JSON file in Cloudinary under `ebay-drafts/<draftId>`, containing: listing, aiPhotos, listingPhotos, status, timestamps. Saving the same ID **overwrites** it. Code: `src/lib/drafts.js`.

Statuses: `processing` → `ready`, or `error` (photos and notes are kept so nothing is lost).

## Camera flow (`/camera`)
1. Capture photos, then Review. Tap photos to mark them for AI (the first 3 are selected by default).
2. Optional **AI Note** / **Draft Note** (blue buttons that open a popup editor; a check mark shows when filled).
3. **Create Draft:** photos upload to Cloudinary **one at a time** (Vercel's ~4.5 MB request cap).
4. The client sends `POST /api/drafts/process` **fire-and-forget**, then navigates to `/drafts`.
5. The server writes a `processing` draft, runs the pipeline (~30–50s), then saves as `ready`.
6. The Drafts page **re-checks every 5 seconds** while anything is processing.

## Duplicate drafts: fixed 2026-06-22 (commit `07df266`)
- **Symptom:** two drafts of the same item, with identical photos and slightly different AI titles, about 10 seconds apart.
- **Cause:** the client navigates away while the long request is still open, and the platform retries the request. The server made a new draft ID each time, so the retry became a second draft.
- **Fix:** the client generates the `draftId` and sends it. The route uses it (validated) instead of making a new one, so a retry overwrites the same draft. A `submitting` guard was also added.
- Older duplicates remain in the list. See [[Open Issues]].

## Opening a draft (`/generate?draft=id`)
- Loads the saved listing. The AI does **not** re-run.
- Item specifics fill (Pass 2) is skipped if specifics already exist.
- The category's allowed conditions are fetched, and an invalid saved condition is auto-corrected. See [[Conditions by Category]].
