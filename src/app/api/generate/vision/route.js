import { NextResponse } from "next/server";

const VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate";

export async function POST(request) {
  try {
    if (!process.env.GOOGLE_CLOUD_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Google Cloud API key not configured" },
        { status: 500 }
      );
    }

    const { imageUrls } = await request.json();

    if (!imageUrls?.length) {
      return NextResponse.json(
        { success: false, error: "No image URLs provided" },
        { status: 400 }
      );
    }

    // Build requests: WEB_DETECTION on first photo, TEXT_DETECTION on all photos
    const requests = [];

    // Web detection on the first (main) photo
    requests.push({
      image: { source: { imageUri: imageUrls[0] } },
      features: [{ type: "WEB_DETECTION", maxResults: 10 }],
    });

    // Text detection on all photos to find style numbers on tags
    for (const url of imageUrls) {
      requests.push({
        image: { source: { imageUri: url } },
        features: [{ type: "TEXT_DETECTION", maxResults: 5 }],
      });
    }

    const res = await fetch(
      `${VISION_API_URL}?key=${process.env.GOOGLE_CLOUD_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      }
    );

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const responses = data.responses || [];

    // First response is web detection
    const webDetection = responses[0]?.webDetection;
    const entities = webDetection
      ? (webDetection.webEntities || [])
          .filter((e) => e.description && e.score > 0.3)
          .map((e) => ({ name: e.description, score: e.score }))
      : [];

    const pageMatches = webDetection
      ? (webDetection.pagesWithMatchingImages || [])
          .slice(0, 5)
          .map((p) => ({ title: p.pageTitle || "", url: p.url || "" }))
      : [];

    // Remaining responses are text detection — collect all detected text
    const detectedTexts = [];
    for (let i = 1; i < responses.length; i++) {
      const annotations = responses[i]?.textAnnotations;
      if (annotations?.length > 0) {
        // First annotation is the full text block
        detectedTexts.push(annotations[0].description);
      }
    }

    // Try to extract style/model numbers from detected text
    // Look for patterns like: Style #ABC123, Style: ABC123, Model MC0200, etc.
    // Exclude RN numbers, UPC/barcodes, care codes
    const styleNumbers = [];
    const stylePatterns = [
      /style\s*[#:]?\s*([A-Z0-9][\w-]{3,15})/gi,
      /model\s*[#:]?\s*([A-Z0-9][\w-]{3,15})/gi,
      /item\s*[#:]?\s*([A-Z0-9][\w-]{3,15})/gi,
      /art(?:icle)?\s*[#:]?\s*([A-Z0-9][\w-]{3,15})/gi,
    ];

    const allText = detectedTexts.join("\n");
    for (const pattern of stylePatterns) {
      let match;
      while ((match = pattern.exec(allText)) !== null) {
        const num = match[1].trim();
        // Skip RN numbers and very short matches
        if (!/^RN/i.test(num) && num.length >= 4) {
          styleNumbers.push(num);
        }
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        entities,
        pageMatches,
        detectedTexts,
        styleNumbers: [...new Set(styleNumbers)],
      },
    });
  } catch (error) {
    console.error("Google Vision error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
