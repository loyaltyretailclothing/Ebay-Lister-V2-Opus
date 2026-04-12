import cloudinary from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { publicId, targetFolder } = await request.json();

    if (!publicId || !targetFolder) {
      return NextResponse.json(
        { success: false, error: "Missing publicId or targetFolder" },
        { status: 400 }
      );
    }

    const assetFolder =
      targetFolder === "All Photos"
        ? "ebay-listings/unassigned"
        : `ebay-listings/${targetFolder.toLowerCase()}`;

    await cloudinary.api.update(publicId, {
      asset_folder: assetFolder,
    });

    return NextResponse.json({
      success: true,
      photo: {
        public_id: publicId,
        folder: targetFolder,
      },
    });
  } catch (error) {
    console.error("Move error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
