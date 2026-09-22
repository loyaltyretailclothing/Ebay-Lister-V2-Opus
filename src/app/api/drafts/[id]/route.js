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

// PATCH /api/drafts/[id] — change ONLY the Skip Draft mark, or ONLY the
// seasonal hold. Body: { skipDraft: boolean } or
// { holdUntil: "YYYY-MM-DD" | null, holdSeason?: string }.
// Reads the saved draft and writes it back with just that field changed, so
// neither ever saves other edits the user hasn't saved yet.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const isSkip = typeof body.skipDraft === "boolean";
    const isHold = "holdUntil" in body;
    if (!isSkip && !isHold) {
      return NextResponse.json(
        { success: false, error: "Nothing to change" },
        { status: 400 }
      );
    }
    if (isHold && body.holdUntil !== null && !/^\d{4}-\d{2}-\d{2}$/.test(body.holdUntil || "")) {
      return NextResponse.json(
        { success: false, error: "holdUntil must be YYYY-MM-DD or null" },
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
    const change = isSkip
      ? { skipDraft: body.skipDraft }
      : {
          holdUntil: body.holdUntil || "",
          holdSeason: body.holdUntil ? String(body.holdSeason || "").slice(0, 20) : "",
        };
    await saveDraft(id, {
      ...draft,
      listing: { ...(draft.listing || {}), ...change },
    });
    return NextResponse.json({ success: true, ...change });
  } catch (error) {
    console.error("Draft patch error:", error);
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
