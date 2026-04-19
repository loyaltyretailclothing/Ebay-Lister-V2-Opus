import { NextResponse } from "next/server";
import { newDraftId, saveDraft } from "@/lib/drafts";
import {
  analyzeListing,
  lookupCategory,
  fetchCategorySpecifics,
  fillItemSpecifics,
  refineStyleName,
  applyDescriptionTemplate,
} from "@/lib/listingPipeline";

// Pipeline takes ~30-60s (Claude vision + eBay + Claude pass 2 + optional
// Brave refine). Vercel default is 10s on Hobby / 60s on Pro; push to 60s so
// we can accommodate the full run.
export const maxDuration = 60;

// POST /api/drafts/process
//
// Body:
//   {
//     listingPhotos: [{ secure_url, public_id, ... }, ...],  // already uploaded to Cloudinary
//     aiPhotoIndices: [0, 3, 5],                              // which photos to analyze
//     notes?: "optional"
//   }
//
// The caller should fire-and-forget this request — the UI shouldn't block on
// the response. A `processing` draft is written immediately so the Drafts
// list reflects the in-flight job. When the pipeline finishes the same
// draftId is re-saved as `ready` (or `error`, with photos preserved).
export async function POST(request) {
  const draftId = newDraftId();
  let listingPhotos = [];
  let aiPhotos = [];

  try {
    const body = await request.json();
    listingPhotos = Array.isArray(body.listingPhotos) ? body.listingPhotos : [];
    const aiIndices = Array.isArray(body.aiPhotoIndices) ? body.aiPhotoIndices : [];
    aiPhotos = aiIndices
      .map((i) => listingPhotos[i])
      .filter(Boolean);
    const notes = body.notes || "";

    if (listingPhotos.length === 0) {
      return NextResponse.json(
        { success: false, error: "No listing photos provided" },
        { status: 400 }
      );
    }

    // 1. Write the processing record immediately so the Drafts tab shows it
    //    the moment the client fires this request.
    await saveDraft(draftId, {
      id: draftId,
      listing: {},
      aiPhotos,
      listingPhotos,
      status: "processing",
      savedAt: new Date().toISOString(),
    });

    // 2. Run the full pipeline.
    const analysisPhotos = aiPhotos.length > 0 ? aiPhotos : listingPhotos.slice(0, 3);
    const listing = await analyzeListing(analysisPhotos, notes);

    // Empty title = Claude couldn't make sense of the photos (wrong subject,
    // blurry, bad lighting, etc.). Technically the pipeline "succeeded" but
    // there's nothing to list, so surface it as an error row instead of a
    // silent "Untitled" draft the user has to open to realize was useless.
    if (!listing?.title || !listing.title.trim()) {
      throw new Error(
        "AI couldn't identify the item — retry with clearer photos of clothing/items."
      );
    }

    // 3. Category + specifics (best-effort — continue without if this fails).
    try {
      const cat = await lookupCategory(listing.category_keywords);
      if (cat) {
        listing.categoryId = cat.categoryId;
        listing.categoryName = cat.categoryName;
        const specificsSchema = await fetchCategorySpecifics(cat.categoryId);
        const filled = await fillItemSpecifics(
          listing.observations,
          specificsSchema,
          listing.title
        );
        listing.itemSpecifics = filled;
      }
    } catch (catErr) {
      console.error("Category/specifics step failed:", catErr);
      // Don't fail the whole draft — user can fix the category manually.
    }

    // 4. Brave refine (best-effort).
    try {
      const refined = await refineStyleName(listing);
      if (refined) Object.assign(listing, refined);
    } catch (refineErr) {
      console.error("Refine step failed:", refineErr);
    }

    // 5. Apply description template — must run LAST so the final title
    //    (post-refine) is the one that lands in the description body.
    //    This overwrites condition_description with the static boilerplate
    //    and builds item_description from the template, keeping camera
    //    drafts in sync with Generate-page output.
    Object.assign(listing, applyDescriptionTemplate(listing));

    // 6. Save the completed draft.
    await saveDraft(draftId, {
      id: draftId,
      listing,
      aiPhotos,
      listingPhotos,
      status: "ready",
      savedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, draftId });
  } catch (error) {
    console.error("Draft processing error:", error);
    // Preserve photos + surface the error on the draft row so the user can
    // see what went wrong and either retry or finish manually.
    try {
      await saveDraft(draftId, {
        id: draftId,
        listing: {},
        aiPhotos,
        listingPhotos,
        status: "error",
        errorMessage: (error.message || "Processing failed").slice(0, 255),
        savedAt: new Date().toISOString(),
      });
    } catch (saveErr) {
      console.error("Failed to persist error draft:", saveErr);
    }
    return NextResponse.json(
      { success: false, draftId, error: error.message },
      { status: 500 }
    );
  }
}
