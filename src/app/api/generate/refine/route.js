import client from "@/lib/claude";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an eBay listing assistant. You will receive:
1. A listing with a style/model number found on the item's tag
2. Web search results for that style number

Your job: extract the MODEL NAME or PRODUCT LINE from the search results, then update the title and observations.

Rules:
- Look at the search result titles and snippets for a specific product/model name
- Only update if you find a clear, specific model/product name (e.g. "Balsama Lava Wash", "Crown Comfort", "Dri-FIT Victory")
- Do NOT update if the results only show generic terms (e.g. "quarter zip", "polo shirt")
- Title MUST be 75-80 characters — use as close to 80 as possible, pack in SEO keywords
- Title structure: [NWT if applicable] Brand | Product Name/Model | Type | Gender | Size | Color | Key Details
- Add the model name to observations as "model"
- If no useful model name found, return exactly: {"updated": false}
- If updating, return: {"updated": true, "title": "new title", "observations": {merged observations}}
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
  const results = (data.web?.results || []).slice(0, 3).map((r) => ({
    title: r.title || "",
    snippet: r.description || "",
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
    let searchResults = [];
    if (process.env.BRAVE_SEARCH_API_KEY) {
      try {
        searchResults = await braveSearch(`${brand || ""} ${styleNumber}`);
      } catch (err) {
        console.error("Brave Search error:", err);
      }
    }

    if (searchResults.length === 0) {
      return NextResponse.json({ success: true, listing: null });
    }

    const searchText = searchResults
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}`)
      .join("\n");

    const userPrompt = `Here is the current listing:
Title: ${listing.title}
Brand: ${brand || "unknown"}
Style Number: ${styleNumber}

Here are the web search results for "${brand || ""} ${styleNumber}":
${searchText}

Extract the model/product name if found. Update the title and observations, or return {"updated": false}.`;

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
