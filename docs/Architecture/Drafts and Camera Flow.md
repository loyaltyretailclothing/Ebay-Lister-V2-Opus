# Drafts and Camera Flow

See [[Overview]], [[AI Pipeline]].

## Storage
Each draft is a raw JSON file in Cloudinary under `ebay-drafts/<draftId>`, containing: listing, aiPhotos, listingPhotos, status, timestamps. Saving the same ID **overwrites** it. Code: `src/lib/drafts.js`.

Statuses: `processing` → `ready`, or `error` (photos and notes are kept so nothing is lost).

## Camera flow (`/camera`)
1. Capture photos, then Review. Tap photos to mark them for AI (the first 3 are selected by default).
2. Optional **Draft Note** / **AI Read** (buttons that open a popup editor; a check mark shows when filled). Each has a 🎤 **voice** button beside it (added 2026-09-18): tap, talk, and the words are added to the end of that note. Uses Chrome's built-in speech-to-text (free, no AI, needs internet; mic permission asked once); stops after a pause or a second tap. The same mics are on the Draft Note / AI Read boxes in Create Listing (phone and desktop). Hidden where the browser has no speech-to-text.
3. **Create Draft:** photos upload to Cloudinary **one at a time** (Vercel's ~4.5 MB request cap).
4. The client sends `POST /api/drafts/process` **fire-and-forget**, then navigates to `/drafts`.
5. The server writes a `processing` draft, runs the pipeline (~30–50s), then saves as `ready`. The title is assembled from SEO keywords and overflow keywords go to Theme (or are dropped if the category has no Theme). See [[Title Keywords Plan]].
6. The Drafts list refreshes **only** when the page opens and when Refresh is tapped (the redesign removed the old 5-second re-check; not live until the redesign ships). Processing drafts show a spinner until a refresh.

## Duplicate drafts: fixed 2026-06-22 (commit `07df266`)
- **Symptom:** two drafts of the same item, with identical photos and slightly different AI titles, about 10 seconds apart.
- **Cause:** the client navigates away while the long request is still open, and the platform retries the request. The server made a new draft ID each time, so the retry became a second draft.
- **Fix:** the client generates the `draftId` and sends it. The route uses it (validated) instead of making a new one, so a retry overwrites the same draft. A `submitting` guard was also added.
- Older duplicates remain in the list. See [[Open Issues]].

## Opening a draft (`/generate?draft=id`)
- Loads the saved listing. The AI does **not** re-run.
- **Analyze Photos on a draft = redo from square one** (after a confirmation): the AI redoes the title, keywords, condition, description, category and item specifics; photos, notes, price, SKU, weight, dimensions and policies are kept. Nothing saves until **Update Draft**.
- Item specifics fill (Pass 2) is skipped if specifics already exist.
- Drafts made with keywords show **keyword chips** under the title. Drafts made before keywords have no chips and keep their title and Theme exactly as saved.
- Typing in the title updates the description's first line to match.
- The category's allowed conditions are fetched, and an invalid saved condition is auto-corrected. See [[Conditions by Category]].
