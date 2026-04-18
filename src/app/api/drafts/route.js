import { NextResponse } from "next/server";
import { listDrafts, saveDraft, newDraftId } from "@/lib/drafts";

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
    const id = body.id || newDraftId();

    const payload = {
      id,
      listing: body.listing || {},
      aiPhotos: body.aiPhotos || [],
      listingPhotos: body.listingPhotos || [],
      savedAt: new Date().toISOString(),
    };

    await saveDraft(id, payload);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Save draft error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
