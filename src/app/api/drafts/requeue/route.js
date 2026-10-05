import { NextResponse } from "next/server";
import { getDraft, isDraftId, saveDraft } from "@/lib/drafts";
import { visionRequest } from "@/lib/listingPipeline";
import { submitOne } from "@/lib/batchAnalyze";

// POST /api/drafts/requeue
// Body: { draftIds: ["draft_...", ...] }  (or { draftId: "draft_..." })
//
// Send a draft that was never analyzed back to Anthropic's queue at half
// price. The camera already does this for a NEW draft (/api/drafts/process
// with queued:true) — this is the same submission for one that already
// exists, so nothing is re-shot or re-uploaded.
//
// Why it exists: when the submission fails — the account out of funds was
// the real case on 2026-10-02, but any hiccup reaching Anthropic does it —
// the draft is saved as `error` with its photos. "Analyze now" can't help:
// that cancels a place in the queue, and a draft that never got submitted
// has no place to cancel. Without this the only way forward was a fresh
// live analysis at full price. See docs/Plans/Batch Analysis Plan.md.
//
// Answers per draft, so one failure doesn't hide the rest:
//   { success: true, results: [{ id, queued: true, batchId } | { id, error }] }

export const maxDuration = 60;

// This is Analyze Photos at half price, so it refuses the same things Analyze
// would and nothing more (users' call 2026-10-04). An ALREADY ANALYZED draft
// is allowed through on purpose: queueing it re-runs the analysis, exactly as
// pressing Analyze Photos again does, and replaces what the AI wrote the same
// way. The button must never be enabled while the route would refuse.
function whyNot(draft) {
  if (!draft) return "Draft not found";
  if (draft.status === "queued" && draft.batch?.id) return "Already in the queue";
  if (draft.status === "processing") return "Still being analyzed";
  if (!(draft.listingPhotos || []).length) return "No photos on this draft";
  return null;
}

async function requeueOne(id) {
  if (!isDraftId(id)) return { id, error: "Invalid draft id" };
  const draft = await getDraft(id);
  const no = whyNot(draft);
  if (no) return { id, error: no };

  const listingPhotos = draft.listingPhotos || [];
  const aiPhotos = (draft.aiPhotos || []).length ? draft.aiPhotos : [];
  // Same fallback the camera uses when nothing was picked for the AI.
  const analysisPhotos = aiPhotos.length ? aiPhotos : listingPhotos.slice(0, 3);
  const aiNote = draft.listing?.aiNote || "";

  const batchId = await submitOne(visionRequest(analysisPhotos, aiNote), `${id}-vision`);
  await saveDraft(id, {
    ...draft,
    id,
    aiPhotos,
    listingPhotos,
    status: "queued",
    // Phase 1 from the top, whether this draft has been analyzed before or
    // not — the same fresh start Analyze Photos gives it.
    batch: { id: batchId, phase: 1, at: new Date().toISOString() },
    // The old failure is answered; don't leave it on the row.
    errorMessage: "",
    savedAt: new Date().toISOString(),
  });
  return { id, queued: true, batchId };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const ids = Array.isArray(body.draftIds)
      ? body.draftIds
      : body.draftId
        ? [body.draftId]
        : [];
    if (!ids.length) {
      return NextResponse.json(
        { success: false, error: "No drafts given" },
        { status: 400 }
      );
    }

    const results = [];
    for (const id of ids) {
      try {
        results.push(await requeueOne(id));
      } catch (err) {
        // Out of funds is the one worth saying in plain words, because the
        // fix is somewhere else entirely and a raw API sentence buries it.
        const raw = err?.message || "Couldn't send that draft to the queue";
        const broke = /credit balance|insufficient|billing|quota/i.test(raw)
          ? "Anthropic account is out of funds — top it up and try again"
          : raw;
        results.push({ id, error: broke.slice(0, 255) });
      }
    }

    return NextResponse.json({
      success: true,
      queued: results.filter((r) => r.queued).length,
      failed: results.filter((r) => r.error).length,
      results,
    });
  } catch (error) {
    console.error("Draft requeue error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
