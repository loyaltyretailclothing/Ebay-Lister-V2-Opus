import { NextResponse } from "next/server";
import { sweepPhotos } from "@/lib/photoSweep";

// Delete the photos of held items that posted more than half an hour ago,
// and say when the next lot is due so an open tab can come back at exactly
// the right minute. POST, because it changes things (and so local test mode
// blocks it). See src/lib/photoSweep.js.
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await sweepPhotos();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Photo sweep failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
