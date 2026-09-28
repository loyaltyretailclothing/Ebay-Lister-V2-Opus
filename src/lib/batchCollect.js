import { getDraft, listDrafts, saveDraft } from "./drafts";
import { GIVE_UP_MS, cancelOne, checkOne, halveTally, submitOne } from "./batchAnalyze";
import { analyzeDraftLive } from "./runAnalysis";
import {
  applyDescriptionTemplate,
  fetchCategorySpecifics,
  fillItemSpecifics,
  lookupCategory,
  newTally,
  readSpecificsReply,
  readVisionReply,
  refineStyleName,
  specificsRequest,
} from "./listingPipeline";
import { applyKeywordTheme } from "./titleKeywords";
import { buildAiEntry, buildCameraEntry } from "./efficiency";
import { writeEntry } from "./efficiencyLog";

// Moving queued drafts along. Anthropic never calls us back, so something
// has to come and ask — an open browser tab, or the morning cron. Both land
// here. Everything needed lives on the draft itself in Cloudinary, so a
// queued draft survives a closed laptop, a redeploy or a week away.
//
// phase 1 answered → ask eBay which category, then queue phase 2
// phase 2 answered → fill the specifics and the draft is ready
//
// See docs/Plans/Batch Analysis Plan.md.

const PER_RUN = 25; // drafts advanced per sweep, so one call can't run away

// Sonnet 5 prices; halveTally applies the batch discount.
const cost = (usage) =>
  ((usage?.input_tokens || 0) / 1e6) * 2 + ((usage?.output_tokens || 0) / 1e6) * 10;

// The queue let this draft down (it expired, errored, or has been sitting
// too long). Run the whole analysis live so the draft is usable, and mark it
// "force" — that label is a warning light, not a receipt: it means the app
// had to step in, which you'd otherwise never know about.
export async function forceLive(draftId, why = "") {
  const draft = await getDraft(draftId);
  if (!draft) return null;
  if (draft.batch?.id) await cancelOne(draft.batch.id);

  const tally = newTally();

  // Phase 2 only owes us the item specifics. The photos have already been
  // read and the draft may have been edited since, so re-running everything
  // would throw those edits away — fill in the specifics and nothing else.
  if (draft.batch?.phase === 2 && draft.listing?.categoryId) {
    const listing = { ...draft.listing };
    try {
      const schema = await fetchCategorySpecifics(listing.categoryId);
      const hasKeywords = Array.isArray(listing.keywords) && listing.keywords.length > 0;
      const filled = await fillItemSpecifics(listing.observations, schema, listing.title, {
        themeManaged: hasKeywords,
        tally,
      });
      const applied = applyKeywordTheme({
        keywords: listing.keywords,
        itemSpecifics: filled,
        hasTheme: schema.some((s) => s.name === "Theme"),
      });
      listing.itemSpecifics = applied.itemSpecifics;
      listing.keywords = applied.keywords;
    } catch (err) {
      console.error("Couldn't fill specifics live:", err);
    }
    await saveDraft(draftId, {
      ...draft,
      listing,
      status: "ready",
      readyBy: why === "asked" ? draft.readyBy || "" : "force",
      batch: null,
      savedAt: new Date().toISOString(),
    });
    await logCost(tally, { ...draft, listing });
    return listing;
  }
  const photos = draft.listingPhotos || [];
  const analysisPhotos = (draft.aiPhotos || []).length ? draft.aiPhotos : photos.slice(0, 3);
  try {
    const listing = await analyzeDraftLive({
      analysisPhotos,
      aiNote: draft.listing?.aiNote,
      draftNote: draft.listing?.draftNote,
      tally,
    });
    await saveDraft(draftId, {
      ...draft,
      listing,
      status: "ready",
      readyBy: why === "asked" ? "" : "force",
      batch: null,
      savedAt: new Date().toISOString(),
    });
    await logCost(tally, { ...draft, listing });
    try {
      const entry = buildCameraEntry({
        timing: draft.timing,
        draftId,
        category: listing.categoryName,
        categoryId: listing.categoryId,
      });
      if (entry) await writeEntry(entry);
    } catch (err) {
      console.error("Efficiency camera log failed:", err);
    }
    return listing;
  } catch (err) {
    await saveDraft(draftId, {
      ...draft,
      status: "error",
      batch: null,
      errorMessage: `${why === "asked" ? "Analyze now failed" : "The queue let this down and the retry failed"} — ${err.message}`.slice(0, 255),
      savedAt: new Date().toISOString(),
    });
    await logCost(tally, draft);
    throw err;
  }
}

async function logCost(tally, draft, waitMs, phase) {
  try {
    const entry = buildAiEntry({
      tally,
      source: "camera",
      draftId: draft.id,
      category: draft.listing?.categoryName,
      categoryId: draft.listing?.categoryId,
      waitMs,
      phase,
    });
    if (entry) await writeEntry(entry);
  } catch (err) {
    console.error("AI cost log failed:", err);
  }
}

// --- phase 1: the photos have been read ------------------------------------
// Everything that makes a draft workable comes out of this phase, so the
// draft is saved as ready here. The specifics arrive behind it (phase 2)
// and fill themselves in — you are never blocked waiting for them.
async function afterVision(draft, text, usage) {
  const tally = halveTally({ ...newTally(), inTokens: usage?.input_tokens || 0, outTokens: usage?.output_tokens || 0, cost: cost(usage) });
  const listing = readVisionReply(text);
  if (!listing?.title?.trim()) {
    throw new Error("AI couldn't identify the item — retry with clearer photos.");
  }
  // Brave refine is small, optional and rarely runs; not worth a third trip
  // through the queue, so it runs live here.
  try {
    const refined = await refineStyleName(listing);
    if (refined) Object.assign(listing, refined);
  } catch (err) {
    console.error("Refine step failed:", err);
  }

  let nextBatch = null;
  try {
    const cat = await lookupCategory(listing.category_keywords);
    if (cat) {
      listing.categoryId = cat.categoryId;
      listing.categoryName = cat.categoryName;
      const schema = await fetchCategorySpecifics(cat.categoryId);
      const hasKeywords = Array.isArray(listing.keywords) && listing.keywords.length > 0;
      const id = await submitOne(
        specificsRequest(listing.observations, schema, listing.title, {
          themeManaged: hasKeywords,
        }),
        `${draft.id}-specifics`
      );
      nextBatch = { id, phase: 2, at: new Date().toISOString(), hasTheme: schema.some((s) => s.name === "Theme") };
    }
  } catch (err) {
    // No category means no specifics to ask about — the draft is still
    // usable and the category can be set by hand.
    console.error("Category/specifics step failed:", err);
  }

  Object.assign(listing, applyDescriptionTemplate(listing));
  listing.aiNote = draft.listing?.aiNote || "";
  listing.draftNote = draft.listing?.draftNote || "";

  return { listing, nextBatch, tally };
}

// --- one draft --------------------------------------------------------------
async function advance(row) {
  const draft = await getDraft(row.id);
  if (!draft?.batch?.id) return "gone";
  const { id: batchId, phase } = draft.batch;
  const waited = Date.now() - Date.parse(draft.batch.at || "");
  const answer = await checkOne(batchId);

  if (answer.state === "waiting") {
    if (waited < GIVE_UP_MS) return "waiting";
    return "give-up"; // caller runs it live
  }
  if (answer.state === "failed") {
    console.error(`Batch ${batchId} failed for ${row.id}: ${answer.reason}`);
    return "give-up";
  }

  if (phase === 1) {
    const { listing, nextBatch, tally } = await afterVision(draft, answer.text, answer.usage);
    await saveDraft(row.id, {
      ...draft,
      listing,
      // Usable now; the specifics catch up.
      status: "ready",
      readyBy: "batch",
      batch: nextBatch,
      savedAt: new Date().toISOString(),
    });
    await logCost(tally, { ...draft, listing }, waited, 1);
    // The camera entry gets its category now that we know it.
    try {
      const entry = buildCameraEntry({
        timing: draft.timing,
        draftId: row.id,
        category: listing.categoryName,
        categoryId: listing.categoryId,
      });
      if (entry) await writeEntry(entry);
    } catch (err) {
      console.error("Efficiency camera log failed:", err);
    }
    return nextBatch ? "phase-2" : "done";
  }

  // phase 2 — eBay's questions have been answered
  const listing = { ...(draft.listing || {}) };
  const tally = halveTally({ ...newTally(), inTokens: answer.usage?.input_tokens || 0, outTokens: answer.usage?.output_tokens || 0, cost: cost(answer.usage) });
  try {
    const filled = readSpecificsReply(answer.text);
    const applied = applyKeywordTheme({
      keywords: listing.keywords,
      itemSpecifics: filled,
      hasTheme: draft.batch.hasTheme !== false,
    });
    listing.itemSpecifics = applied.itemSpecifics;
    listing.keywords = applied.keywords;
  } catch (err) {
    console.error("Couldn't read the specifics reply:", err);
  }
  await saveDraft(row.id, {
    ...draft,
    listing,
    status: "ready",
    readyBy: draft.readyBy || "batch",
    batch: null,
    savedAt: new Date().toISOString(),
  });
  await logCost(tally, { ...draft, listing }, waited, 2);
  return "done";
}

// Advance every draft that is waiting on the queue. Returns a small summary
// so the caller (a tab, or the cron) can say what happened.
export async function collectBatches() {
  const drafts = await listDrafts();
  const queued = drafts.filter((d) => d.batchPhase > 0).slice(0, PER_RUN);
  const out = { checked: queued.length, done: 0, waiting: 0, movedToPhase2: 0, giveUp: [] };

  for (const row of queued) {
    try {
      const result = await advance(row);
      if (result === "done") out.done += 1;
      else if (result === "phase-2") out.movedToPhase2 += 1;
      else if (result === "waiting") out.waiting += 1;
      else if (result === "give-up") {
        // Run it live rather than leave a draft with nothing to show.
        await forceLive(row.id).catch((err) =>
          console.error(`Forced retry failed for ${row.id}:`, err)
        );
        out.giveUp.push(row.id);
      }
    } catch (err) {
      console.error(`Couldn't advance queued draft ${row.id}:`, err);
      await forceLive(row.id).catch(() => {});
      out.giveUp.push(row.id);
    }
  }
  return out;
}
