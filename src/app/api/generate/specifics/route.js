import client from "@/lib/claude";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert eBay listing assistant. You will be given:
1. A set of observations about an item (from photo analysis)
2. A list of eBay item specifics for the selected category, each with their allowed preset values

Your job: fill in EVERY item specific with the best value.

Rules:
- ALWAYS prefer eBay's preset values when one matches (case-insensitive). Use the EXACT preset spelling and casing from the values list — never invent your own casing.
- CRITICAL for Brand: If the brand exists in the preset values list, you MUST use the exact preset spelling (e.g. "Peter Millar" not "PETER MILLAR"). Search the values list carefully before using a custom value.
- If no preset value matches but you have a relevant observation, provide a custom value with proper title casing for SEO benefit.
- If you truly have no information for a specific, use null.
- For required specifics, make your best effort — never leave them null unless truly unknown.
- For "Size" specifics, match the format eBay expects (e.g. "Regular - S" not just "S" if the presets use that format).
- For "Department" or "Gender" specifics, map observations like "Mens" to the eBay preset (e.g. "Men").
- THEME: Use Theme as an SEO keyword overflow field. Pick 2-3 relevant themes that did NOT fit in the 80-character title. Only use actual themes/styles (e.g. "Athletic", "Casual", "Outdoor", "Holiday", "Tropical", "Vintage", "Streetwear"). Do NOT put features here — Stretch, Lined, Moisture-Wicking, etc. are features, not themes. Never leave Theme null — always find relevant keywords.
- MULTI-VALUE SPECIFICS: Some specifics accept multiple values (like Theme, Features, etc.). When providing multiple values for a single specific, return them as a JSON array: ["value1", "value2"]. NEVER combine multiple values into one comma-separated string.
- SEASON: Infer the season from the item type, material, and weight. Fleece/heavy knits = "Fall", "Winter". Linen/lightweight = "Spring", "Summer". Use eBay preset values when they match.
- Return ONLY valid JSON, no markdown or explanation.

Return format:
{
  "specifics": {
    "Specific Name": "value",
    "Another Specific": "value",
    ...
  }
}`;

export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const { observations, specifics, title } = await request.json();

    if (!specifics?.length) {
      return NextResponse.json(
        { success: false, error: "No specifics provided" },
        { status: 400 }
      );
    }

    // Build a compact representation of specifics for the prompt
    const specificsForPrompt = specifics.map((s) => ({
      name: s.name,
      required: s.required,
      values: s.values.length > 0 ? s.values.slice(0, 200) : "free_text",
    }));

    const userPrompt = `Here are my observations about the item:
${JSON.stringify(observations || {}, null, 2)}

The listing title is: "${title || ""}"
(Use this to know which keywords are already in the title — put additional SEO keywords in Theme)

Here are the eBay item specifics for this category. Fill in every one:
${JSON.stringify(specificsForPrompt, null, 2)}

Return the filled specifics as JSON.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
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
        throw new Error("Could not parse AI response as JSON");
      }
    }

    return NextResponse.json({ success: true, specifics: result.specifics });
  } catch (error) {
    console.error("Pass 2 specifics error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
