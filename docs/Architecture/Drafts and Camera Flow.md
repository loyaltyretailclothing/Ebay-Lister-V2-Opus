# Drafts and Camera Flow

See [[Overview]], [[AI Pipeline]].

## Storage
Each draft is a raw JSON file in Cloudinary under `ebay-drafts/<draftId>`, containing: listing, aiPhotos, listingPhotos, status, timestamps. Saving the same ID **overwrites** it. Code: `src/lib/drafts.js`.

Statuses: `processing` → `ready`, or `error` (photos and notes are kept so nothing is lost).

**The id is a file name (2026-09-28).** A draft id becomes `ebay-drafts/<id>` in Cloudinary, so every route that takes one checks it first (`isDraftId` in `src/lib/drafts.js`: letters, digits, `_` and `-`, up to 100 characters). An id with a slash or a dot in it could otherwise point at another draft or at one of the log files, to read, overwrite or delete. The camera route had this check from the start; the other four were added after the audit of 2026-09-27.

**Listing them all (fixed 2026-09-27):** Cloudinary answers 500 records at a time, and `listDrafts` only ever read the first page. Everything reads that one list — the queue, the On Hold page and the 7am posting run — so past 500 drafts some would have silently disappeared from all three, and a held item could have reached its morning without ever being seen. It now follows the cursor (stopping at 20 pages, i.e. 10,000 drafts). 74 records today: still one page, one call. Found in the code audit of 2026-09-27.

## Camera flow (`/camera`)
1. Capture photos, then Review. Tap photos to mark them for AI (the first 3 are selected by default).
2. Optional **Draft Note** / **AI Read** (buttons that open a popup editor; a check mark shows when filled). Each has a 🎤 **voice** button beside it (added 2026-09-18): tap, talk, and the words are added to the end of that note. Uses Chrome's built-in speech-to-text (free, no AI, needs internet; mic permission asked once); shows what it heard in green ("Added: …") for 3 seconds after the mic stops (2026-09-21 — it used to vanish the instant the mic turned off), stops after 1 second of silence (the app's own timer — Chrome's pause detection can't be tuned), after 8 seconds if nothing is said, or on a second tap. The same mics are on the Draft Note / AI Read boxes in Create Listing (phone and desktop). Hidden where the browser has no speech-to-text.
2a. **Add** (2026-09-28) — beside Create Draft, opens the phone's own photo library for pictures taken outside the app (the users photograph wash-care tags while laundering). Pick several at once; they join the end of the grid and behave exactly like camera shots — tap for AI, delete, counted by Create Draft. A draft can be made from library photos alone.
    - Each picked photo is **shrunk to 1600px and re-encoded as JPEG on the phone first** (`resizeImage`). A camera shot is already sized for upload; one from the camera roll is several times bigger and, on an iPhone, usually HEIC — both of which the upload refuses. Measured: a 4.37 MB 4032×3024 photo became a 251 KB 1600×1200 JPEG.
    - Anything that still can't be read is skipped with "1 photo couldn't be added — try taking a screenshot of it and adding that", and the rest of the draft is unaffected.
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
