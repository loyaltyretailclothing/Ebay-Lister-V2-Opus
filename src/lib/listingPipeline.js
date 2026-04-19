// Shared listing-generation pipeline.
//
// Both the interactive Generate page (via /api/generate*, /api/ebay/*)
// and the background Camera flow (via /api/drafts/process) run the same
// steps against the same prompts. Keeping them here means title rules,
// specifics prompts, and parsing fallbacks stay in sync.

import client from "@/lib/claude";
import { ebayRequest, getUserToken } from "@/lib/ebay";
import { EBAY_BASE_URL } from "@/lib/constants";
import { TITLE_RULES } from "@/lib/titleRules";

// ---------------------------------------------------------------------------
// Vision pass — analyze photos and return the initial listing JSON
// ---------------------------------------------------------------------------

export const VISION_SYSTEM_PROMPT = `You are an expert eBay listing assistant. You analyze photos of items and generate accurate listing details for eBay.

${TITLE_RULES}

You must return a JSON object with these fields:
{
  "title": "Follow the TITLE FORMULA above exactly — 75-80 characters, universal slot order, no banned words.",
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
- 2-INCH RULE (pants/shorts/jeans only): If measured waist OR inseam differs from tag by 2+ inches, use the MEASURED size in the title and in observations.size. Always populate observations.tag_size and observations.measured_size with their respective values — the app will auto-build the 'Tag - X / Measures Y' lines in the description.
- NWT = tags are visibly attached in photos
- Look at ALL photos carefully — tags, labels, measurements, defects
- If you cannot determine a field, use null
- The observations object should capture EVERYTHING you can identify — these will be used to fill eBay item specifics
- STYLE NUMBER: If you see a style number, model number, or product code on any tag, capture it in the style_number field. Do NOT capture RN numbers, UPC/barcodes, or care instruction codes — those are not style numbers.
- NECKLINE: Infer neckline from item type, not just visuals. Hoodies = Crew Neck. Quarter zips = Mock Neck. Polo shirts = Collared. V-neck sweaters = V-Neck. Always fill this field — never leave it null.
- BUTTON-DOWN SHIRTS — CATEGORY RULE (does NOT affect title): The ONLY way to choose the category for button-down shirts is the SIZE TAG format. Letter sizes (S, M, L, XL, 2XL, 3XL, etc.) = category_keywords must be "mens casual button down shirt". Numeric neck sizes (14.5, 15, 15.5, 16, 16.5, 17, etc.) = category_keywords must be "mens dress shirt". Do NOT use the shirt's appearance, fabric, or style to decide the category — ONLY the size format on the tag matters. The title should describe the shirt naturally (brand, features, size, color, etc.) — do NOT force "Casual Button-Down" or "Dress Shirt" into the title.
- Return ONLY valid JSON, no markdown or explanation`;

function parseListingJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1].trim());
    const obj = text.match(/\{[\s\S]*"title"[\s\S]*"observations"[\s\S]*\}/);
    if (obj) return JSON.parse(obj[0]);
    throw new Error("Could not parse AI response as JSON");
  }
}

export async function analyzeListing(photos, notes) {
  if (!photos?.length) throw new Error("No photos provided");

  const content = [];
  if (notes) content.push({ type: "text", text: `User notes about this item: ${notes}` });

  for (const photo of photos) {
    const analysisUrl = photo.secure_url.replace(
      "/upload/",
      "/upload/c_limit,w_600,q_70/"
    );
    content.push({
      type: "image",
      source: { type: "url", url: analysisUrl },
    });
  }

  content.push({
    type: "text",
    text: "Analyze these photos and generate the eBay listing details as JSON. Look at every photo carefully for brand, tags, labels, condition, measurements, and defects.",
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: VISION_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const textBlocks = response.content.filter((b) => b.type === "text");
  const responseText = textBlocks.map((b) => b.text).join("\n");
  return parseListingJson(responseText);
}

// ---------------------------------------------------------------------------
// eBay category lookup
// ---------------------------------------------------------------------------

export async function lookupCategory(keywords) {
  if (!keywords) return null;
  const data = await ebayRequest(
    `/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(keywords)}`
  );
  const first = (data.categorySuggestions || [])[0];
  if (!first) return null;
  return {
    categoryId: first.category.categoryId,
    categoryName: first.category.categoryName,
    ancestors: first.categoryTreeNodeAncestors?.map((a) => a.categoryName) || [],
  };
}

// ---------------------------------------------------------------------------
// eBay item-specifics schema for a category
// ---------------------------------------------------------------------------

function mapAspects(aspects) {
  return (aspects || []).map((aspect) => ({
    name: aspect.localizedAspectName,
    localizedName: aspect.localizedAspectName,
    required: aspect.aspectConstraint?.aspectRequired || false,
    dataType: aspect.aspectConstraint?.aspectDataType || "STRING",
    mode: aspect.aspectConstraint?.aspectMode || "FREE_TEXT",
    values: (aspect.aspectValues || []).map((v) => v.localizedValue),
    maxValues: aspect.aspectConstraint?.aspectMaxValues || 1,
  }));
}

export async function fetchCategorySpecifics(categoryId) {
  if (!categoryId) throw new Error("No categoryId provided");
  try {
    const token = await getUserToken();
    const res = await fetch(
      `${EBAY_BASE_URL}/sell/metadata/v1/marketplace/EBAY_US/get_item_aspects_for_category?category_id=${categoryId}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );
    if (!res.ok) throw new Error("Sell Metadata API failed");
    const data = await res.json();
    return mapAspects(data.aspects);
  } catch {
    const data = await ebayRequest(
      `/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`
    );
    return mapAspects(data.aspects);
  }
}

// ---------------------------------------------------------------------------
// Pass 2 — AI-fill item specifics from observations
// ---------------------------------------------------------------------------

export const SPECIFICS_SYSTEM_PROMPT = `You are an expert eBay listing assistant. You will be given:
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

export async function fillItemSpecifics(observations, specifics, title) {
  if (!specifics?.length) throw new Error("No specifics provided");

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
    system: SPECIFICS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText = response.content[0].text;
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    const fenced = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!fenced) throw new Error("Could not parse AI response as JSON");
    result = JSON.parse(fenced[1].trim());
  }
  return result.specifics || {};
}

// ---------------------------------------------------------------------------
// Brave-refine pass — find style name, rebuild title
// ---------------------------------------------------------------------------

export const REFINE_SYSTEM_PROMPT = `You are an eBay listing assistant. You will receive:
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
  if (!res.ok) throw new Error(`Brave Search failed: ${res.status}`);
  const data = await res.json();
  return (data.web?.results || []).slice(0, 5).map((r) => ({
    title: r.title || "",
    snippet: r.description || "",
    url: r.url || "",
  }));
}

// Returns { title?, observations? } to merge into the listing, or null if no
// style name was found (or Brave wasn't configured / returned nothing).
export async function refineStyleName(listing) {
  const styleNumber = listing.observations?.style_number;
  const brand = listing.observations?.brand;
  if (!styleNumber) return null;
  if (!process.env.BRAVE_SEARCH_API_KEY) return null;

  const query = `${brand || ""} ${styleNumber}`.trim();
  let searchResults = [];
  try {
    searchResults = await braveSearch(query);
  } catch (err) {
    console.error("Brave Search error:", err);
    return null;
  }
  if (searchResults.length === 0) return null;

  const searchText = searchResults
    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
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
    system: REFINE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText = response.content[0].text;
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    const fenced = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      result = JSON.parse(fenced[1].trim());
    } else {
      const obj = responseText.match(/\{[\s\S]*"updated"[\s\S]*\}/);
      if (!obj) return null;
      result = JSON.parse(obj[0]);
    }
  }

  if (!result.updated) return null;

  const merge = {};
  if (result.title) merge.title = result.title;
  if (result.observations) {
    merge.observations = { ...listing.observations, ...result.observations };
  }
  return merge;
}

// Re-export pure description-template helpers so server-side callers that
// already import from this module keep working. The helpers themselves live
// in descriptionTemplate.js so client components can safely import them
// without pulling in Claude/eBay SDKs.
export {
  parsePantSize,
  checkTwoInchRule,
  getConditionBoilerplate,
  buildDescription,
  applyTwoInchAsterisk,
  applyDescriptionTemplate,
} from "@/lib/descriptionTemplate";

// ---------------------------------------------------------------------------
// Clean multi-select specifics against the category's settings config
// (specific entries marked multiSelect get comma-strings split into arrays)
// ---------------------------------------------------------------------------

export function cleanMultiSelectSpecifics(specifics, categoryConfig) {
  if (!categoryConfig?.specifics) return specifics;
  const cleaned = { ...specifics };
  for (const [key, val] of Object.entries(cleaned)) {
    if (
      categoryConfig.specifics[key]?.multiSelect &&
      typeof val === "string" &&
      val.includes(",")
    ) {
      cleaned[key] = val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return cleaned;
}
