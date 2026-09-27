import { NextResponse } from "next/server";
import { getDraft, deleteDraft, draftPhotoIds, markPhotosHeld, saveDraft } from "@/lib/drafts";
import { dueTime } from "@/lib/photoSweep";

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
    // A held draft's photos leave the Photo Library; unholding brings them back.
    if (isHold) {
      try {
        await markPhotosHeld(draftPhotoIds(draft), body.holdUntil ? id : "");
      } catch (err) {
        console.error("Could not update held photos:", err);
      }
    }
    return NextResponse.json({ success: true, ...change });
  } catch (error) {
    console.error("Draft patch error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/drafts/[id][?photos=1][?posted=1] — delete a draft, and its
// photos when the confirm dialog's "Also delete this draft's photos" box was
// ticked. `posted=1` means a HELD draft has just gone live on eBay: its
// photos stay out of the library and are deleted half an hour later.
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const query = new URL(request.url).searchParams;
    const deletePhotos = query.get("photos") === "1";
    const posted = query.get("posted") === "1";
    await deleteDraft(id, { deletePhotos, photosAfter: posted ? dueTime() : null });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete draft error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
