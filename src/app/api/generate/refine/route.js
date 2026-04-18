import client from "@/lib/claude";
import { NextResponse } from "next/server";
import { TITLE_RULES } from "@/lib/titleRules";

const SYSTEM_PROMPT = `You are an eBay listing assistant. You will receive:
1. An existing listing (title, condition, observations) with a style/model number found on the tag
2. Web search results (title, snippet, URL) for that style number

Your job has TWO parts:

PART 1 — Extract the STYLE NAME from the search results.

How to extract a style name from a product title:
- Strip the leading gender/descriptor word(s) — e.g. "Women's", "Men's", "Kids'", "Unisex"
- Strip the trailing item type — e.g. "Shirt", "Jacket", "Polo", "Pants", "Hoodie", "Vest", "Tee"
- Whatever is left in the middle IS the style name, even if it sounds partly descriptive
- Style names are often multi-word and can include words like "Print", "Sun Protection", "Lightweight", "Performance" — keep those words; they are part of the name
- The product URL slug is a strong signal — e.g. "/duluth-womens-soul-survivor-sun-protection-shirt-55207" tells you the style name is "Soul Survivor Sun Protection"

Examples:
- "Women's Soul Survivor Sun Protection Shirt" → style name: "Soul Survivor Sun Protection"
- "Patagonia Men's Balsama Lava Wash Jacket" → style name: "Balsama Lava Wash"
- "Nike Dri-FIT Victory Polo" → style name: "Dri-FIT Victory"
- "Men's Classic Quarter Zip Pullover" → no specific style name, return {"updated": false}

Decision rules:
- If 2 or more results agree on the same style name (or a close variant), use it
- If only generic type words remain after stripping gender + type, return {"updated": false}

PART 2 — If you found a style name, REBUILD the title from scratch using the rules below. Do NOT just insert the style name into the existing title. Generate a fresh title that follows the formula exactly and packs in tier 2 extras to hit 75-80 characters.

${TITLE_RULES}

Response format:
- If no style name found: return exactly {"updated": false}
- If style name found: return {"updated": true, "title": "freshly rebuilt 75-80 char title", "observations": {"model": "the style name"}}
- Return ONLY valid JSON, no markdown or explanation`;

async function braveSearch(query) {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Brave Search failed: ${res.status}`);
  }

  const data = await res.json();
  const results = (data.web?.results || []).slice(0, 5).map((r) => ({
    title: r.title || "",
    snippet: r.description || "",
    url: r.url || "",
  }));

  return results;
}

export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const { listing } = await request.json();

    const styleNumber = listing.observations?.style_number;
    const brand = listing.observations?.brand;

    if (!styleNumber) {
      return NextResponse.json({ success: true, listing: null });
    }

    // Search Brave for brand + style number
    const query = `${brand || ""} ${styleNumber}`.trim();

    let searchResults = [];
    if (process.env.BRAVE_SEARCH_API_KEY) {
      try {
        searchResults = await braveSearch(query);
      } catch (err) {
        console.error("Brave Search error:", err);
      }
    }

    if (searchResults.length === 0) {
      return NextResponse.json({ success: true, listing: null });
    }

    const searchText = searchResults
      .map(
        (r, i) =>
          `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`
      )
      .join("\n");

    const obs = listing.observations || {};
    const userPrompt = `Here is the current listing:
Current Title: ${listing.title}
Condition: ${listing.condition || "unknown"}
Observations: ${JSON.stringify(
      {
        brand: obs.brand,
        type: obs.type,
        size: obs.size,
        tag_size: obs.tag_size,
        measured_size: obs.measured_size,
        gender: obs.gender,
        color: obs.color,
        pattern: obs.pattern,
        material: obs.material,
        features: obs.features,
        closure: obs.closure,
        neckline: obs.neckline,
        sleeve_length: obs.sleeve_length,
        style: obs.style,
        style_number: obs.style_number,
      },
      null,
      2
    )}

Here are the web search results for "${query}":
${searchText}

Step 1: Extract the style name using the extraction rules.
Step 2: If found, REBUILD the title from scratch using TITLE_RULES above — do not just patch the existing title. Use observations (brand, type, size, gender, color, features) + the new style name, and pack tier 2 extras to reach 75-80 chars. Respect the NWT-only condition prefix rule and the banned-word list.

If no style name found, return {"updated": false}.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const responseText = response.content[0].text;
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        const objectMatch = responseText.match(/\{[\s\S]*"updated"[\s\S]*\}/);
        if (objectMatch) {
          result = JSON.parse(objectMatch[0]);
        } else {
          return NextResponse.json({ success: true, listing: null });
        }
      }
    }

    if (!result.updated) {
      return NextResponse.json({ success: true, listing: null });
    }

    // Merge updated fields back
    const updatedListing = {};
    if (result.title) updatedListing.title = result.title;
    if (result.observations) {
      updatedListing.observations = {
        ...listing.observations,
        ...result.observations,
      };
    }

    return NextResponse.json({ success: true, listing: updatedListing });
  } catch (error) {
    console.error("Refine error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
