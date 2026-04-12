import client from "@/lib/claude";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert eBay listing assistant. You analyze photos of items and generate accurate listing details for eBay.

You must return a JSON object with these fields:
{
  "title": "Up to 80 characters. Structure: [NWT if applicable] Brand | Product Name | Type | Gender | Size | Color | Key Details. If pre-owned, no 'New With Tags'. For pants: if measured size differs from tag by 2+ inches, use measured size in title.",
  "category_keywords": "2-3 keywords to search eBay categories (e.g. 'mens dress shirt')",
  "condition": "One of: NEW_WITH_TAGS, NEW_WITHOUT_TAGS, NEW_WITH_DEFECTS, PRE_OWNED",
  "condition_description": "For pre-owned items, describe the condition. For NWT, leave as empty string.",
  "brand": "The brand name",
  "color": "Primary color(s)",
  "size": "Size as shown on tag or measured",
  "measured_size": "Measured size if visible/applicable, otherwise null",
  "tag_size": "Tag size if visible, otherwise null",
  "gender": "Mens, Womens, Unisex, Boys, Girls",
  "material": "Material/fabric if visible on tag",
  "country_of_manufacture": "Country if visible on tag/label, otherwise null",
  "style": "Style details (e.g. slim fit, regular, athletic)",
  "item_description": "A brief 2-3 sentence description of the item suitable for an eBay listing",
  "suggested_search_terms": "Keywords to search eBay for sold comps (e.g. 'Nike Dri-Fit mens polo shirt large blue')"
}

Rules:
- Be precise with brand names — spell them exactly as shown
- For pants with the 2-inch rule: if measured waist or inseam differs from tag by 2+ inches, note BOTH sizes
- NWT = tags are visibly attached in photos
- Look at ALL photos carefully — tags, labels, measurements, defects
- If you cannot determine a field from the photos, use null
- Return ONLY valid JSON, no markdown or explanation`;

export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const { photos, notes } = await request.json();

    if (!photos?.length) {
      return NextResponse.json(
        { success: false, error: "No photos provided" },
        { status: 400 }
      );
    }

    // Build the content array with images
    const content = [];

    // Add any user notes first
    if (notes) {
      content.push({
        type: "text",
        text: `User notes about this item: ${notes}`,
      });
    }

    // Add each photo as a base64 image or URL
    for (const photo of photos) {
      // Use Cloudinary URL with 800px resize for AI analysis
      const analysisUrl = photo.secure_url.replace(
        "/upload/",
        "/upload/c_limit,w_800,q_75/"
      );

      content.push({
        type: "image",
        source: {
          type: "url",
          url: analysisUrl,
        },
      });
    }

    content.push({
      type: "text",
      text: "Analyze these photos and generate the eBay listing details as JSON. Look at every photo carefully for brand, tags, labels, condition, measurements, and defects.",
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    // Parse the JSON from Claude's response
    const responseText = response.content[0].text;
    let listing;
    try {
      // Try to parse directly
      listing = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        listing = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("Could not parse AI response as JSON");
      }
    }

    return NextResponse.json({ success: true, listing });
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
