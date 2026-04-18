import { ebayRequest } from "@/lib/ebay";
import { NextResponse } from "next/server";

// Diagnostic endpoint: inspect an eBay inventory item by SKU to see
// the image URLs we sent and check whether each one is reachable.
//
// Usage: /api/ebay/inspect?sku=C3195
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get("sku");

    if (!sku) {
      return NextResponse.json(
        { success: false, error: "Missing ?sku= query param" },
        { status: 400 }
      );
    }

    // 1. Fetch the inventory item from eBay
    let inventoryItem;
    try {
      inventoryItem = await ebayRequest(
        `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
        {
          headers: {
            "Accept-Language": "en-US",
            "Content-Language": "en-US",
          },
        }
      );
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error: `Could not fetch inventory item for SKU "${sku}": ${err.message}`,
        },
        { status: 404 }
      );
    }

    const imageUrls = inventoryItem?.product?.imageUrls || [];

    // 2. Probe each URL with a HEAD request to see if it's reachable.
    // Report status, content-type, and content-length for each.
    const probes = await Promise.all(
      imageUrls.map(async (url, index) => {
        const slot = index + 1;
        try {
          const res = await fetch(url, { method: "HEAD", redirect: "follow" });
          return {
            slot,
            url,
            ok: res.ok,
            status: res.status,
            contentType: res.headers.get("content-type") || null,
            contentLength: res.headers.get("content-length") || null,
          };
        } catch (err) {
          return {
            slot,
            url,
            ok: false,
            status: null,
            error: err.message,
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      sku,
      photoCount: imageUrls.length,
      photos: probes,
    });
  } catch (error) {
    console.error("Inspect error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
