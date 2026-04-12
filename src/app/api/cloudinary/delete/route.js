import { deletePhotos } from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { publicIds } = await request.json();

    if (!publicIds?.length) {
      return NextResponse.json(
        { success: false, error: "No photo IDs provided" },
        { status: 400 }
      );
    }

    const result = await deletePhotos(publicIds);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
