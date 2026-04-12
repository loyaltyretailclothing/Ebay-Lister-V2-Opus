import cloudinary from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "All Photos";

    let prefix;
    if (folder === "All Photos") {
      prefix = "ebay-listings";
    } else {
      prefix = `ebay-listings/${folder.toLowerCase()}`;
    }

    const expression =
      folder === "All Photos"
        ? `resource_type:image AND folder:ebay-listings/*`
        : `resource_type:image AND folder:${prefix}`;

    const result = await cloudinary.search
      .expression(expression)
      .with_field("context")
      .sort_by("created_at", "desc")
      .max_results(500)
      .execute();

    const photos = result.resources.map((r) => ({
      public_id: r.public_id,
      secure_url: r.secure_url,
      width: r.width,
      height: r.height,
      folder: r.context?.folder || "All Photos",
      note: r.context?.note || "",
      created_at: r.created_at,
    }));

    return NextResponse.json({ success: true, photos });
  } catch (error) {
    console.error("List error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
