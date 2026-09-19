import { NextResponse } from "next/server";
import { listEntries, writeEntry } from "@/lib/efficiencyLog";

// Efficiency Tracker log.
//   GET  → every entry (the report does the math in the browser)
//   POST → add one entry, written after a successful List on eBay
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await listEntries();
    return NextResponse.json({ success: true, entries });
  } catch (error) {
    console.error("Efficiency log read error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const entry = await request.json();
    await writeEntry(entry);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Efficiency log write error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
