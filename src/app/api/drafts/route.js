import { NextResponse } from "next/server";
import {
  draftPhotoIds,
  getDraft,
  isDraftId,
  listDrafts,
  markPhotosHeld,
  newDraftId,
  saveDraft,
} from "@/lib/drafts";

// GET /api/drafts — list all drafts (summary only)
export async function GET() {
  try {
    const drafts = await listDrafts();
    return NextResponse.json({ success: true, drafts });
  } catch (error) {
    console.error("List drafts error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/drafts — create or update a draft
// Body: { id?: string, listing: {...}, aiPhotos: [...], listingPhotos: [...] }
// Returns: { success: true, id }
export async function POST(request) {
  try {
    const body = await request.json();
    // The id becomes a file name — only ever the shape we generate.
    if (body.id !== undefined && body.id !== null && !isDraftId(body.id)) {
      return NextResponse.json({ success: false, error: "Invalid draft id" }, { status: 400 });
    }
    const id = body.id || newDraftId();

    // Saving from the editor sends the listing and its photos, nothing more.
    // A draft can also be waiting in Anthropic's queue, and that state lives
    // on the draft — so carry it over rather than letting an ordinary save
    // quietly drop it and strand the answer. See lib/batchCollect.js.
    const existing = body.id ? await getDraft(body.id).catch(() => null) : null;
    const payload = {
      id,
      listing: body.listing || {},
      aiPhotos: body.aiPhotos || [],
      listingPhotos: body.listingPhotos || [],
      ...(existing?.batch ? { batch: existing.batch, status: existing.status } : {}),
      ...(existing?.timing ? { timing: existing.timing } : {}),
      ...(existing?.readyBy ? { readyBy: existing.readyBy } : {}),
      savedAt: new Date().toISOString(),
    };

    await saveDraft(id, payload);
    // Held drafts keep their photos out of the Photo Library (Hold until…
    // saves through here); saving without a hold releases them.
    try {
      await markPhotosHeld(draftPhotoIds(payload), payload.listing?.holdUntil ? id : "");
    } catch (err) {
      console.error("Could not update held photos:", err);
    }
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Save draft error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
