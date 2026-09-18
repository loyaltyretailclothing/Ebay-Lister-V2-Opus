import { NextResponse } from "next/server";
import { getDraft, deleteDraft, saveDraft } from "@/lib/drafts";

// GET /api/drafts/[id] — fetch full draft payload
export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const draft = await getDraft(id);
    if (!draft) {
      return NextResponse.json(
        { success: false, error: "Draft not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, draft });
  } catch (error) {
    console.error("Get draft error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/drafts/[id] — change ONLY the Skip Draft mark.
// Body: { skipDraft: boolean }
// Reads the saved draft and writes it back with just that one field changed,
// so ticking Skip Draft never saves other edits the user hasn't saved yet.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (typeof body.skipDraft !== "boolean") {
      return NextResponse.json(
        { success: false, error: "skipDraft must be true or false" },
        { status: 400 }
      );
    }
    const draft = await getDraft(id);
    if (!draft) {
      return NextResponse.json(
        { success: false, error: "Draft not found" },
        { status: 404 }
      );
    }
    await saveDraft(id, {
      ...draft,
      listing: { ...(draft.listing || {}), skipDraft: body.skipDraft },
    });
    return NextResponse.json({ success: true, skipDraft: body.skipDraft });
  } catch (error) {
    console.error("Skip draft error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/drafts/[id] — delete a draft
export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    await deleteDraft(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete draft error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
