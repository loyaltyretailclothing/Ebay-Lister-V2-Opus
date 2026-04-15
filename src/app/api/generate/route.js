import client from "@/lib/claude";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert eBay listing assistant. You analyze photos of items and generate accurate listing details for eBay.

You must return a JSON object with these fields:
{
  "title": "MUST be 75-80 characters — use as close to 80 as possible. Pack in SEO keywords to fill the space. Structure: [NWT if applicable] Brand | Product Name/Model (if known) | Type | Gender | Size | Color | Key Details. Type (e.g. Quarter Zip, Polo Shirt, Hoodie) MUST come before Gender/Size/Color — never at the end. Add extra descriptors (fabric, style, features) to reach 80 chars. If pre-owned, no 'New With Tags'. For pants: if measured size differs from tag by 2+ inches, use measured size. CORRECT: 'Peter Millar Crown Comfort Quarter Zip Mens Medium Navy Blue Waffle Knit Pullover' WRONG: 'Peter Millar Mens Medium Navy Blue Waffle Knit Quarter Zip'",
  "category_keywords": "2-3 keywords to search eBay categories (e.g. 'mens dress shirt')",
  "condition": "One of: NEW_WITH_TAGS, NEW_WITHOUT_TAGS, NEW_WITH_DEFECTS, PRE_OWNED_EXCELLENT, PRE_OWNED_GOOD, PRE_OWNED_FAIR",
  "condition_description": "For pre-owned items, describe the condition in detail including any flaws. For NWT or NWOT, leave as empty string.",
  "suggested_search_terms": "Keywords to search eBay for sold comps (e.g. 'Nike Dri-Fit mens polo shirt large blue')",
  "observations": {
    "brand": "The brand name exactly as shown",
    "color": "Primary color(s)",
    "size": "Size as shown on tag or measured",
    "measured_size": "Measured size if visible, otherwise null",
    "tag_size": "Tag size if visible, otherwise null",
    "gender": "Mens, Womens, Unisex, Boys, Girls",
    "material": "Material/fabric if visible on tag",
    "country_of_manufacture": "Country if visible on tag/label, otherwise null",
    "style": "Style details (e.g. slim fit, regular, athletic)",
    "type": "Product type (e.g. hoodie, jeans, polo shirt)",
    "pattern": "Pattern if applicable (e.g. solid, striped, plaid)",
    "closure": "Closure type if visible (e.g. zipper, button, pullover)",
    "neckline": "Neckline if applicable (e.g. crew neck, v-neck, hooded)",
    "sleeve_length": "Sleeve length if applicable (e.g. short sleeve, long sleeve)",
    "rise": "For pants/jeans/shorts ONLY: estimate the rise from the photos. One of: Ultra Low, Low, Mid, High. Most standard pants are Mid. Low-rise sits below the navel, high-rise sits at or above. null for non-pants items.",
    "features": "Notable features (e.g. pockets, logo, embroidery)",
    "style_number": "Style number, model number, or product code from tag — NOT RN numbers, NOT UPC/barcodes, NOT care codes. null if not found.",
    "...any other details you observe": "Include ALL details you can identify from the photos"
  }
}

Rules:
- Be precise with brand names — spell them exactly as shown
- For pants with the 2-inch rule: if measured waist or inseam differs from tag by 2+ inches, note BOTH sizes
- NWT = tags are visibly attached in photos
- Look at ALL photos carefully — tags, labels, measurements, defects
- If you cannot determine a field, use null
- The observations object should capture EVERYTHING you can identify — these will be used to fill eBay item specifics
- STYLE NUMBER: If you see a style number, model number, or product code on any tag, capture it in the style_number field. Do NOT capture RN numbers, UPC/barcodes, or care instruction codes — those are not style numbers.
- NECKLINE: Infer neckline from item type, not just visuals. Hoodies = Crew Neck. Quarter zips = Mock Neck. Polo shirts = Collared. V-neck sweaters = V-Neck. Always fill this field — never leave it null.
- BUTTON-DOWN SHIRTS — CATEGORY RULE (does NOT affect title): The ONLY way to choose the category for button-down shirts is the SIZE TAG format. Letter sizes (S, M, L, XL, 2XL, 3XL, etc.) = category_keywords must be "mens casual button down shirt". Numeric neck sizes (14.5, 15, 15.5, 16, 16.5, 17, etc.) = category_keywords must be "mens dress shirt". Do NOT use the shirt's appearance, fabric, or style to decide the category — ONLY the size format on the tag matters. The title should describe the shirt naturally (brand, features, size, color, etc.) — do NOT force "Casual Button-Down" or "Dress Shirt" into the title.
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
      // Use Cloudinary URL with 600px resize for AI analysis
      const analysisUrl = photo.secure_url.replace(
        "/upload/",
        "/upload/c_limit,w_600,q_70/"
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

    // Run Claude (web search disabled for now to save costs)
    const messages = [{ role: "user", content }];
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages,
    });

    // Extract all text blocks from the final response
    const textBlocks = response.content.filter((b) => b.type === "text");
    const responseText = textBlocks.map((b) => b.text).join("\n");
    let listing;
    let searchPerformed = false;

    // Check if any web search was performed across all messages
    for (const msg of messages) {
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        if (msg.content.some((b) => b.type === "web_search_tool_result")) {
          searchPerformed = true;
          break;
        }
      }
    }
    // Also check the final response
    if (response.content.some((b) => b.type === "web_search_tool_result")) {
      searchPerformed = true;
    }

    try {
      // Try to parse directly
      listing = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        listing = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try to find JSON object anywhere in the text
        const objectMatch = responseText.match(/\{[\s\S]*"title"[\s\S]*"observations"[\s\S]*\}/);
        if (objectMatch) {
          listing = JSON.parse(objectMatch[0]);
        } else {
          throw new Error("Could not parse AI response as JSON");
        }
      }
    }

    // Add metadata about whether style search was performed
    listing._styleSearched = searchPerformed;

    return NextResponse.json({ success: true, listing });
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
