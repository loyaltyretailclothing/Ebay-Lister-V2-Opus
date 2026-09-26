import { NextResponse } from "next/server";
import { deleteListed, listListed, writeListed } from "@/lib/listedLog";

// The Listed report's records.
//   GET  → everything listed (newest first)
//   POST → add one, written right after a successful List on eBay
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ success: true, items: await listListed() });
  } catch (error) {
    console.error("Listed report read error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await writeListed(await request.json());
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Listed report write error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE — take rows off the report (after the details are in Flipwise).
// Body: { listingIds: [...] }. The eBay listings are not touched.
export async function DELETE(request) {
  try {
    const { listingIds } = await request.json();
    const removed = await deleteListed(listingIds);
    return NextResponse.json({ success: true, removed });
  } catch (error) {
    console.error("Listed report delete error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
