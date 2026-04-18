import { NextResponse } from "next/server";
import { getDraft, deleteDraft } from "@/lib/drafts";

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
