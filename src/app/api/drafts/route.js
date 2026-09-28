import { NextResponse } from "next/server";
import { listDrafts, saveDraft, newDraftId, draftPhotoIds, isDraftId, markPhotosHeld } from "@/lib/drafts";

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

    const payload = {
      id,
      listing: body.listing || {},
      aiPhotos: body.aiPhotos || [],
      listingPhotos: body.listingPhotos || [],
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
