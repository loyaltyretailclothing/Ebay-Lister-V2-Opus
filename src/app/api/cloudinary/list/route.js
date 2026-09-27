import cloudinary from "@/lib/cloudinary";
import { NextResponse } from "next/server";

// Cloudinary's search API caps each call at 500 results and returns a
// next_cursor when more are available. We paginate client-side so that
// libraries with thousands of photos can be browsed via a "load older
// photos" button rather than silently truncating at 500.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "All Photos";
    const cursor = searchParams.get("next_cursor") || null;
    // A held draft's own photos, by the mark on them. Asked for directly
    // because they can be far older than the newest batch the library
    // loads — filtering the loaded page would miss them entirely.
    const heldFor = (searchParams.get("heldFor") || "").replace(/[^A-Za-z0-9_-]/g, "");

    let prefix;
    if (folder === "All Photos") {
      prefix = "ebay-listings";
    } else {
      prefix = `ebay-listings/${folder.toLowerCase()}`;
    }

    const expression = heldFor
      ? `resource_type:image AND context.heldDraft="${heldFor}"`
      : folder === "All Photos"
        ? `resource_type:image AND folder:ebay-listings/*`
        : `resource_type:image AND folder:${prefix}`;

    let search = cloudinary.search
      .expression(expression)
      .with_field("context")
      .sort_by("created_at", "desc")
      .max_results(500);

    if (cursor) {
      search = search.next_cursor(cursor);
    }

    const result = await search.execute();

    const photos = result.resources.map((r) => ({
      public_id: r.public_id,
      secure_url: r.secure_url,
      width: r.width,
      height: r.height,
      folder: r.context?.folder || "All Photos",
      note: r.context?.note || "",
      // Seasonal Hold: set while the photo belongs to a held draft. Those
      // photos are kept out of the library and shown only inside that draft.
      heldDraft: r.context?.heldDraft || "",
      created_at: r.created_at,
    }));

    return NextResponse.json({
      success: true,
      photos,
      next_cursor: result.next_cursor || null,
    });
  } catch (error) {
    console.error("List error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
