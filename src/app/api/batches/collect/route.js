import { NextResponse } from "next/server";
import { collectBatches, forceLive } from "@/lib/batchCollect";
import { isDraftId } from "@/lib/drafts";

// POST /api/batches/collect
//   {}                      → move every queued draft along
//   { draftId: "draft_…" }  → pull that one out of the queue and run it live
//                             ("Analyze now")
//
// Anthropic never calls us back, so something has to come and ask. An open
// browser tab does (see BatchCollector) and so does the morning cron. POST
// because it changes things — which also means local test mode blocks it.
// See docs/Plans/Batch Analysis Plan.md.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.draftId) {
      if (!isDraftId(body.draftId)) {
        return NextResponse.json({ success: false, error: "Invalid draft id" }, { status: 400 });
      }
      const listing = await forceLive(body.draftId, "asked");
      return NextResponse.json({ success: true, forced: true, title: listing?.title || "" });
    }
    return NextResponse.json({ success: true, ...(await collectBatches()) });
  } catch (error) {
    console.error("Batch collect failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
