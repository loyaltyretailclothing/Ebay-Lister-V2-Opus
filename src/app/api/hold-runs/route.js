import { NextResponse } from "next/server";
import { listRuns } from "@/lib/holdRuns";

// GET /api/hold-runs — what the last posting mornings did (On Hold page).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ success: true, runs: await listRuns() });
  } catch (error) {
    console.error("Hold runs read error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
