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
import { assembleListingTitle, hasTitleParts } from "@/lib/titleKeywords";

// --- Cost logging -----------------------------------------------------------
// Reads the usage object every Anthropic response already includes (free —
// no extra call) and prints one [COST] line per AI pass to the server logs
// (visible in the Vercel dashboard). Count "[COST] pass1-vision" lines to
// see how many listings were analyzed; sum the est=$ amounts (or read the
// auto-summed total in the Anthropic Console) for total spend.
// Claude Sonnet 5 pricing: $2 / million input, $10 / million output.
const SONNET_INPUT_PER_M = 2;
const SONNET_OUTPUT_PER_M = 10;

// The model for every AI pass. Switched from claude-sonnet-4-6 on
// 2026-09-18 — to go back, set this to "claude-sonnet-4-6" and the prices
// above to 3 / 15. Sonnet 5 "thinks" by default (billed as output); it's
// turned off to work like 4.6 did. Its token counting runs ~30% higher for
// the same text, so max_tokens has headroom.
const MODEL = "claude-sonnet-5";
const NO_THINKING = { type: "disabled" };


// The reply text (skips any non-text blocks).
function replyText(response) {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
// A running total for one analysis, so what it cost can be written down
// rather than only printed. Passed in by the caller — never module-level
// state, which two requests running at once would mix together.
export function newTally() {
  return { inTokens: 0, outTokens: 0, cost: 0, passes: [] };
}

function logUsage(pass, usage, tally) {
  if (!usage) return;
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  const est =
    (inTok / 1e6) * SONNET_INPUT_PER_M + (outTok / 1e6) * SONNET_OUTPUT_PER_M;
  console.log(
    `[COST] ${pass} in=${inTok} out=${outTok} est=$${est.toFixed(4)}`
  );
  if (tally) {
    tally.inTokens += inTok;
    tally.outTokens += outTok;
    tally.cost += est;
    tally.passes.push(pass);
  }
}

// ---------------------------------------------------------------------------
// Vision pass — analyze photos and return the initial listing JSON
// ---------------------------------------------------------------------------

export const VISION_SYSTEM_PROMPT = `You are an expert eBay listing assistant. You analyze photos of items and generate accurate listing details for eBay.

${TITLE_RULES}

You must return a JSON object with these fields:
{
  "title_parts": {
    "brand": "Brand exactly as on the tag",
    "style_name": "Style name per the [Style Name] slot rules, or null",
    "type": "Item type as it should read in the title (e.g. 'Quarter Zip', 'Jeans')",
    "gender": "Mens, Womens, Boys, Girls, or Unisex",
    "size": "Size as it should read in the title (measured size if the 2-inch rule applies)",
    "color": "Primary color as it should read in the title"
  },
  "keywords": [
    {"keyword": "Best search keyword", "tier": 1},
    {"keyword": "Next keyword", "tier": 2}
  ],
  "title": "Your own complete title following the TITLE FORMULA — used only as a backup if title_parts is missing.",
  "category_keywords": "2-3 keywords to search eBay categories (e.g. 'mens dress shirt')",
  "condition": "One of: NEW_WITH_TAGS, NEW_WITHOUT_TAGS, NEW_WITH_DEFECTS, PRE_OWNED_EXCELLENT, PRE_OWNED_GOOD, PRE_OWNED_FAIR",
  "observations": {
    "brand": "The brand name exactly as shown",
    "style_name": "The specific product line or model name (e.g. 'Tech Fleece', 'Retro-X', 'Detroit Jacket', 'Crown Comfort', 'Soul Survivor Sun Protection'). Apply the SAME rules as the title's [Style Name] slot — skip fabric technologies (Dri-FIT, HeatGear, ClimaCool, Omni-Wick), marketing adjectives alone (Pro, Elite, Premium, Performance), and style codes/SKUs. Must match the [Style Name] slot in the title. null if no confident style name exists.",
    "color": "Primary color(s)",
    "size": "Size as shown on tag or measured",
    "measured_size": "Measured size if visible, otherwise null",
    "tag_size": "Tag size if visible, otherwise null",
    "measurements": {
      "chest_in": "Tops: chest in WHOLE inches, read off the tape in the photos. A number only — no quotes, no units, no text. null if not measured.",
      "length_in": "Tops: length in WHOLE inches. Number only. null if not measured.",
      "waist_in": "Bottoms: waist in WHOLE inches. Number only. null if not measured.",
      "rise_in": "Bottoms: rise in WHOLE inches — the MEASURED rise off the tape, not the Low/Mid/High estimate above. Number only. null if not measured.",
      "inseam_in": "Bottoms: inseam in WHOLE inches. Number only. null if not measured."
    },
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
  },
  "flaws": [{ "color": "One of: red, orange, blue, green, black, white — the colour of the arrow marking this flaw", "photo": "Which AI photo the arrow is in, as a number", "where": "Where on the garment, a few words (e.g. 'left cuff', 'right front thigh')", "text": "One short sentence describing the flaw, or null for a white arrow — see FLAWS" }],
  "notes_for_seller": ["Short 'check this' note for the seller — see NOTES FOR SELLER. Empty array when you are confident."]
}

Rules:
- FLAWS — READ THIS FIRST, AND BEFORE YOU WRITE THE flaws FIELD.
  You are NOT the one who decides whether this garment has a flaw. The seller decides, by laying a coloured magnetic arrow on the garment and photographing it. Your only job is to read arrows.
    * A flaw entry REQUIRES a coloured arrow you can actually SEE lying on the garment in one of these photos. No visible arrow, no entry. There is no other way for a flaw to get into the list.
    * If you see NO arrow in any photo, "flaws" is [] — an empty array. This is the normal case and it is the correct answer even when the garment plainly shows wear, pilling, fading, marks, loose threads or damage. Say NOTHING about any of it — not in flaws, not in notes_for_seller, not anywhere. An unmarked mark is not a flaw. A worn-looking garment with no arrows has no flaws.
    * NEVER infer a flaw from the condition of the garment, from how used it looks, or from your own judgement. If you find yourself writing a flaw because you noticed something rather than because you saw an arrow, stop and delete it.
  When an arrow IS visible, the COLOUR tells you what kind of flaw it is — do not work it out yourself:
    red = hole, tear or rip · orange = stain or discoloration · blue = pilling or fabric wear · green = fading · black = broken or missing hardware (button, zip, drawstring) · white = the seller will describe this one himself
  And then:
    1. The colour decides the kind. A red arrow is a hole even if it looks like a stain to you. Never contradict the colour.
    2. NEVER say how big a flaw is. No "small", "large", "quarter-sized", no measurements. The photos show it.
    3. Two or more arrows of the SAME colour on one garment = ONE entry covering both, naming both places (e.g. "Holes at the left cuff and right elbow"). Never two entries of the same colour.
    4. WHITE IS DIFFERENT. Set "text": null and describe nothing at all — the seller writes that one. Each white arrow is its own entry; white NEVER merges with anything, not even another white.
    5. "photo" is which AI photo the arrow appears in, counting the photos you were given in order — the same numbering as notes_for_seller.
- KEYWORDS: follow the KEYWORDS rules above — SEO-ranked (Tier 1 best), 12-15 keywords, true for this item, no keyword spam
- Be precise with brand names — spell them exactly as shown
- SIZE COMES FROM THE TAG. The size in the title and in observations.size is the size printed on the tag, always. NEVER change it because a measurement suggests a different size — a 48" chest on a shirt tagged M is still an M. If a measurement disagrees with the tag, say so in notes_for_seller and leave the size alone.
- 2-INCH RULE — the ONE exception to the rule above, and it applies ONLY to trousers, jeans and shorts whose tag size is a waist x inseam number such as 32x30. It NEVER applies to anything sized S/M/L/XL, and NEVER to a top of any kind. If the measured waist OR inseam differs from the tag by 2+ inches, use the MEASURED waist x inseam in the title and in observations.size. Always populate observations.tag_size and observations.measured_size with their respective values — the app will auto-build the 'Tag - X / Measures Y' lines in the description.
- MEASUREMENTS: fill observations.measurements by reading the tape measure in the photos. WHOLE inches, a plain number in each slot — never a sentence, never a unit, never a range. NEVER estimate a measurement you cannot see on a tape: if it isn't measured, the value is null. The seller measures every item, so a measurement you cannot read is probably there and unreadable rather than absent — say which one in notes_for_seller. Keep filling observations.measured_size as well, in your own words; the numbered slots are what the listing prints.
- NWT = tags are visibly attached in photos
- Look at ALL photos carefully — tags, labels, measurements, defects
- If you cannot determine a field, use null
- The observations object should capture EVERYTHING you can identify — these will be used to fill eBay item specifics
- STYLE NUMBER: If you see a style number, model number, or product code on any tag, capture it in the style_number field. Do NOT capture RN numbers, UPC/barcodes, or care instruction codes — those are not style numbers.
- NECKLINE: Infer neckline from item type, not just visuals. Hoodies = Crew Neck. Quarter zips = Mock Neck. Polo shirts = Collared. V-neck sweaters = V-Neck. Always fill this field — never leave it null.
- BUTTON-DOWN SHIRTS — CATEGORY RULE (does NOT affect title): The ONLY way to choose the category for button-down shirts is the SIZE TAG format. Letter sizes (S, M, L, XL, 2XL, 3XL, etc.) = category_keywords must be "mens casual button down shirt". Numeric neck sizes (14.5, 15, 15.5, 16, 16.5, 17, etc.) = category_keywords must be "mens dress shirt". Do NOT use the shirt's appearance, fabric, or style to decide the category — ONLY the size format on the tag matters. The title should describe the shirt naturally (brand, features, size, color, etc.) — do NOT force "Casual Button-Down" or "Dress Shirt" into the title.
- NOTES FOR SELLER: notes_for_seller is a short "check this" list for the seller, read before listing. Add a note ONLY when you are genuinely unsure about something that could cause a return or a wrong listing — at most 3 notes, each one short sentence (under 20 words), starting with what to check. Good reasons: the size tag is not visible or unreadable and the size is a guess; the tag size and the measurements disagree; the brand or style is a best guess; a measurement you would expect is missing or unreadable (name which one). Do NOT add notes for things you are confident about, do NOT restate the listing, and do NOT give general advice. When you are confident about everything, return an empty array.
- Return ONLY valid JSON, no markdown or explanation`;

// The six arrow colours and nothing else. See docs/Plans/Flaws Plan.md.
const ARROW_COLORS = ["red", "orange", "blue", "green", "black", "white"];

// Tidy the AI's flaws array into something the app can trust. Anything whose
// colour isn't one of the six is dropped — a flaw whose kind we can't read
// off an arrow is exactly what this system exists to avoid. A white arrow is
// forced back to text:null however chatty the model got, because the seller
// writes those and a model's guess must never reach a buyer.
export function cleanFlaws(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => {
      const color = String(f?.color || "").trim().toLowerCase();
      if (!ARROW_COLORS.includes(color)) return null;
      const photo = Number(f?.photo);
      const text = String(f?.text || "").trim();
      return {
        color,
        where: String(f?.where || "").trim().slice(0, 80),
        photo: Number.isInteger(photo) && photo > 0 ? photo : null,
        text: color === "white" || !text ? null : text.slice(0, 200),
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

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

// Each pass is split in two: the request it would send, and how to read the
// reply. The live path builds a request, sends it, and reads the answer; the
// batch path sends the same request to Anthropic's queue and reads the answer
// whenever it comes back (see src/lib/batchAnalyze.js). One prompt, one
// parser, two ways of posting it — nothing can drift between them.
export function visionRequest(photos, notes) {
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

  return {
    model: MODEL,
    thinking: NO_THINKING,
    max_tokens: 6000,
    system: VISION_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  };
}

export async function analyzeListing(photos, notes, tally) {
  const response = await client.messages.create(visionRequest(photos, notes));
  logUsage("pass1-vision", response.usage, tally);
  return readVisionReply(replyText(response));
}

export function readVisionReply(responseText) {
  const parsed = parseListingJson(responseText);

  // Title pieces + SEO keywords → the app assembles the final title. The NWT
  // flag is set from the condition (not the AI) so the NWT-only rule always
  // holds. If the pieces are missing, assembleListingTitle leaves the AI's own
  // title in place.
  if (parsed && parsed.title_parts && typeof parsed.title_parts === "object") {
    parsed.titleParts = {
      ...parsed.title_parts,
      nwt: parsed.condition === "NEW_WITH_TAGS",
    };
  }
  if (parsed && typeof parsed === "object") {
    delete parsed.title_parts;
    // Always set both fields so a re-analysis never inherits the previous
    // item's pieces/keywords on the Create Listing page.
    if (!parsed.titleParts) parsed.titleParts = null;
    if (!Array.isArray(parsed.keywords)) parsed.keywords = [];
    // Without pieces the AI's own title is kept and there are no chips.
    if (!hasTitleParts(parsed)) parsed.keywords = [];
    // The AI's "check this" notes for the seller (the read-only AI Note
    // box). Always set, so a re-analysis replaces the previous notes.
    parsed.aiMessages = (Array.isArray(parsed.notes_for_seller) ? parsed.notes_for_seller : [])
      .map((n) => String(n || "").trim())
      .filter(Boolean)
      .slice(0, 3);
    delete parsed.notes_for_seller;
    // Arrow-marked flaws (8b). Kept as the raw signal — colour, place, photo
    // — because the colour is the thing we trust and the Flaws box is seeded
    // from it. An unknown colour is dropped rather than guessed at: the whole
    // point is that the colour, not the model, decides what a flaw is.
    parsed.flaws = cleanFlaws(parsed.flaws);
  }
  return assembleListingTitle(parsed);
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
    // How many answers eBay takes for this one. The old `aspectMaxValues`
    // doesn't exist in eBay's API (it always came back empty); the real
    // field is itemToAspectCardinality: SINGLE or MULTI. Anything but a
    // clear MULTI is treated as one answer only — e.g. Closure, which eBay
    // rejects when two are sent.
    multi: aspect.aspectConstraint?.itemToAspectCardinality === "MULTI",
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

// Fetch the condition IDs a category allows via the Sell Metadata
// get_item_condition_policies endpoint. Returns an array of conditionId
// strings (e.g. ["1000","1500","3000"]). Best-effort: on any failure
// returns [] so callers fall back to "show all conditions" rather than
// blocking the form. Note the response shape differs from item aspects —
// it nests under itemConditionPolicies[].itemConditions[].
export async function fetchCategoryConditions(categoryId) {
  if (!categoryId) return [];
  try {
    const token = await getUserToken();
    const filter = encodeURIComponent(`categoryIds:{${categoryId}}`);
    const res = await fetch(
      `${EBAY_BASE_URL}/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=${filter}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );
    if (!res.ok) throw new Error("Condition policies API failed");
    const data = await res.json();
    const policy = (data.itemConditionPolicies || [])[0];
    const conditions = policy?.itemConditions || [];
    return conditions.map((c) => String(c.conditionId));
  } catch (err) {
    console.error("fetchCategoryConditions failed:", err);
    return [];
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
- CRITICAL for Brand: use the brand named in the observations or the title, written the way the brand writes itself (e.g. "Peter Millar" not "PETER MILLAR", "TravisMathew" not "Travis Mathew"). Brand usually has no preset list — that is expected, and a missing list is NEVER a reason to answer "Unbranded". Only answer "Unbranded" when there is genuinely no brand on the item. If a preset list IS given for Brand, use its exact spelling when one matches.
- If no preset value matches but you have a relevant observation, provide a custom value with proper title casing for SEO benefit.
- If you truly have no information for a specific, use null.
- For required specifics, make your best effort — never leave them null unless truly unknown.
- For "Size" specifics, match the format eBay expects (e.g. "Regular - S" not just "S" if the presets use that format).
- For "Department" or "Gender" specifics, map observations like "Mens" to the eBay preset (e.g. "Men").
- THEME: If the request says "Theme is managed by the app", return null for Theme — the app fills it with overflow keywords. Otherwise: use Theme as an SEO keyword overflow field. Pick 2-3 relevant themes that did NOT fit in the 80-character title. Only use actual themes/styles (e.g. "Athletic", "Casual", "Outdoor", "Holiday", "Tropical", "Vintage", "Streetwear"). Do NOT put features here — Stretch, Lined, Moisture-Wicking, etc. are features, not themes. Never leave Theme null — always find relevant keywords.
- HOW MANY VALUES: Each specific in the list says whether eBay accepts more than one value ("multi": true) or exactly one ("multi": false). For "multi": false you MUST return a single string — never an array, never two values joined by a comma, slash or "and" (e.g. Closure must be "Button", NOT ["Button","Zip"] and NOT "Button/Zip"). eBay rejects the whole listing otherwise. For "multi": true you may return a JSON array of values: ["value1", "value2"]. NEVER combine multiple values into one comma-separated string.
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

// eBay's value lists are alphabetical and we can only afford to send the
// first 200. For a field like Brand that has thousands, those 200 are
// "everything starting with a digit or A" — the real brand is almost never
// among them. Worse, the model was told to prefer a listed value, so a
// Johnnie-O came back as "Unbranded" (position 0 in the list). Those fields
// are free text on eBay anyway, so we send no list and let the AI write what
// it read off the tag. Everything eBay actually constrains keeps its values.
// Measured 2026-09-28: only Brand crosses this line in the categories they
// list (Model, the next largest, has 363).
const LONG_LIST = 500;

function sendableValues(s) {
  if (!s.values?.length) return "free_text";
  if (s.mode === "FREE_TEXT" && s.values.length > LONG_LIST) return "free_text";
  return s.values.slice(0, 200);
}

// themeManaged: true when the listing has SEO keywords — the app puts
// overflow keywords in Theme itself, so Pass 2 must leave Theme empty.
// Listings without keywords (older drafts) keep the original Theme behavior.
export function specificsRequest(observations, specifics, title, { themeManaged = false } = {}) {
  if (!specifics?.length) throw new Error("No specifics provided");

  const specificsForPrompt = specifics.map((s) => ({
    name: s.name,
    required: s.required,
    // Whether eBay takes more than one value for this one (see mapAspects).
    multi: s.multi === true,
    values: sendableValues(s),
  }));

  // Compact JSON (no indentation) — the model parses it identically, and
  // pretty-printing a category's full value lists wastes a meaningful chunk
  // of input tokens on newlines/indent. Zero accuracy impact.
  const userPrompt = `Here are my observations about the item:
${JSON.stringify(observations || {})}

The listing title is: "${title || ""}"
${
  themeManaged
    ? "Theme is managed by the app — return null for Theme."
    : "(Use this to know which keywords are already in the title — put additional SEO keywords in Theme)"
}

Here are the eBay item specifics for this category. Fill in every one:
${JSON.stringify(specificsForPrompt)}

Return the filled specifics as JSON.`;

  return {
    model: MODEL,
    thinking: NO_THINKING,
    max_tokens: 6000,
    system: SPECIFICS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  };
}

export async function fillItemSpecifics(observations, specifics, title, opts = {}) {
  const response = await client.messages.create(
    specificsRequest(observations, specifics, title, opts)
  );
  logUsage("pass2-specifics", response.usage, opts.tally);
  return readSpecificsReply(replyText(response));
}

export function readSpecificsReply(responseText) {
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

PART 2 — If you found a style name, also write a backup title from scratch using the rules below (the app normally rebuilds the title itself from the style name and the listing's keywords; your title is only used if that isn't possible).

${TITLE_RULES}

Response format:
- If no style name found: return exactly {"updated": false}
- If style name found: return {"updated": true, "style_name": "the style name", "title": "backup 75-80 char title"}
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
export async function refineStyleName(listing, tally) {
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
Observations: ${JSON.stringify({
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
  })}

Here are the web search results for "${query}":
${searchText}

Step 1: Extract the style name using the extraction rules.
Step 2: If found, write a backup title from scratch using TITLE_RULES above. Use observations (brand, type, size, gender, color, features) + the new style name. Respect the NWT-only condition prefix rule and the banned-word list.

If no style name found, return {"updated": false}.`;

  const response = await client.messages.create({
    model: MODEL,
    thinking: NO_THINKING,
    max_tokens: 1000,
    system: REFINE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  logUsage("pass3-refine", response.usage, tally);

  const responseText = replyText(response);
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

  // Accept both the new ({style_name}) and old ({observations:{style_name}})
  // response shapes.
  const styleName = result.style_name || result.observations?.style_name || null;

  const merge = {};
  merge.observations = {
    ...listing.observations,
    ...(result.observations || {}),
    ...(styleName ? { style_name: styleName } : {}),
  };

  if (styleName && hasTitleParts(listing)) {
    // Rebuild from the pieces with the new style name, reusing the listing's
    // SEO keywords (placement is recomputed; keywords that now repeat a
    // style-name word are removed automatically).
    const rebuilt = assembleListingTitle({
      ...listing,
      observations: merge.observations,
      titleParts: { ...listing.titleParts, style_name: styleName },
    });
    merge.title = rebuilt.title;
    merge.titleParts = rebuilt.titleParts;
    merge.keywords = rebuilt.keywords;
  } else if (result.title) {
    merge.title = result.title;
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
