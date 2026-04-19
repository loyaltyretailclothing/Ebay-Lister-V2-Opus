import { uploadPhoto } from "@/lib/cloudinary";
import { NextResponse } from "next/server";

// Allow the full ~60s window for multi-photo uploads on slow mobile networks.
export const maxDuration = 60;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files");
    const folder = formData.get("folder") || "All Photos";

    if (!files.length) {
      return NextResponse.json(
        { success: false, error: "No files provided" },
        { status: 400 }
      );
    }

    const results = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const folderPath =
        folder === "All Photos"
          ? "ebay-listings/unassigned"
          : `ebay-listings/${folder.toLowerCase()}`;

      const result = await uploadPhoto(buffer, {
        folder: folderPath,
        width: 1600,
        height: 1600,
        quality: 75,
        context: `folder=${folder}`,
      });

      results.push({
        public_id: result.public_id,
        secure_url: result.secure_url,
        width: result.width,
        height: result.height,
        folder: folder,
        created_at: result.created_at,
      });
    }

    return NextResponse.json({ success: true, photos: results });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
