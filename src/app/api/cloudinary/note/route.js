import cloudinary from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { publicId, note } = await request.json();

    if (!publicId) {
      return NextResponse.json(
        { success: false, error: "No photo ID provided" },
        { status: 400 }
      );
    }

    await cloudinary.uploader.explicit(publicId, {
      type: "upload",
      context: `note=${note || ""}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Note error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
