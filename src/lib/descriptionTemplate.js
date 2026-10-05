// Pure description-template helpers — safe to import from client components.
//
// These were originally in listingPipeline.js, but that module pulls in the
// Anthropic SDK and eBay API helpers at the top level, which breaks when
// bundled into the browser. Keeping these in their own dependency-free file
// lets the Generate page (a client component) share the exact same logic the
// Camera server pipeline uses.

// A number the AI wrote next to a word, in either order:
//   "Waist 30" · "Waist: 30" · "34 waist" · "6 inch inseam"
//
// The number must sit NEXT TO its word. The pattern this replaced allowed
// six characters of anything between them, which was enough to hop over a
// comma: "34 waist, 7 inseam" bound the waist to the 7 that belonged to the
// inseam, and a 34" waist went out as 7". Found 2026-10-02 on real drafts —
// two saved shorts were titled 7* and 6* because of it.
function labelledInches(text, word) {
  const s = String(text || "");
  const num = "(\\d{1,2}(?:\\.\\d)?)";
  // Word first: only spaces or a colon/dash may sit between it and the number.
  const after = new RegExp(`${word}\\s*[:\\-]?\\s*${num}`, "i").exec(s);
  if (after) return Number(after[1]);
  // Number first, optionally with a unit: "34 waist", "6 inch inseam".
  const before = new RegExp(`${num}\\s*(?:in(?:ch(?:es)?)?\\.?\\s*)?${word}`, "i").exec(s);
  return before ? Number(before[1]) : null;
}

// A bottom's size, in whatever shape it was written:
//   "32x30" · "Waist 27, Inseam 7" · "W32" · "Men's 33" · "30"
// Returns { waist, inseam } with null for anything not stated — shorts very
// often have a waist and no inseam. A letter size (M, L, XL) is NOT a waist
// measurement and returns null, so the 2-inch rule can never touch it.
export function parseBottomSize(sizeStr) {
  const s = String(sizeStr || "").trim();
  if (!s) return null;
  const bare = s.replace(/^men'?s\s*/i, "").replace(/\s+/g, " ").trim();
  if (/^(XS|S|M|L|XL|XXL|[2-7]XL|SMALL|MEDIUM|LARGE)$/i.test(bare)) return null;

  const both = /(\d{1,2}(?:\.\d)?)\s*[x×]\s*(\d{1,2}(?:\.\d)?)/i.exec(s);
  if (both) return { waist: Number(both[1]), inseam: Number(both[2]) };

  const waist = labelledInches(s, "waist");
  const inseam = labelledInches(s, "inseam");
  if (waist != null || inseam != null) return { waist, inseam };

  // A lone number, with or without a W: that's the waist.
  const only = /^w?\s*(\d{2}(?:\.\d)?)\s*w?$/i.exec(bare);
  return only ? { waist: Number(only[1]), inseam: null } : null;
}

// Back-compat: [waist, inseam] for callers that expect the old shape. Null
// when either half is missing, which is what those callers assumed.
export function parsePantSize(sizeStr) {
  const p = parseBottomSize(sizeStr);
  return p && p.waist != null && p.inseam != null ? [p.waist, p.inseam] : null;
}

// One measurement the AI put in its own named slot — observations.measurements
// .waist_in and friends. Whole inches, a plain number, no sentence to read.
// Null when it wasn't measured. See docs/Plans/Future Features.md #8a.
export function namedInches(observations, key) {
  const v = observations?.measurements?.[key];
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// What the tape says, for the 2-inch rule. The named numbers first, because
// nothing can misread them; the written sentence only for drafts saved before
// 8a, which have no named fields. Returns null when neither has anything.
function measuredBottom(o) {
  const prose = parseBottomSize(o?.measured_size) || {};
  const waist = namedInches(o, "waist_in") ?? prose.waist ?? null;
  const inseam = namedInches(o, "inseam_in") ?? prose.inseam ?? null;
  return waist == null && inseam == null ? null : { waist, inseam };
}

// 2-inch rule: for pants/shorts/jeans, if tag vs measured waist OR inseam
// differ by 2+ inches, surface both in the description so buyers know the
// real fit.
export function checkTwoInchRule(observations) {
  const itemType = (observations?.type || "").toLowerCase();
  const isBottom = ["pants", "jeans", "shorts", "trousers", "chinos"].some((t) =>
    itemType.includes(t)
  );
  if (!isBottom) return false;
  // The tag stays a tag reading — it's what's printed on the label, not
  // something measured, so it has no named field.
  const tag = parseBottomSize(observations?.tag_size);
  const measured = measuredBottom(observations);
  if (!tag || !measured) return false;

  // Compare only what BOTH sides state. Shorts often have a waist and no
  // inseam, so a missing inseam means the rule runs on the waist alone
  // rather than not running at all (users' call 2026-09-29).
  const diffs = [];
  if (tag.waist != null && measured.waist != null) diffs.push(Math.abs(tag.waist - measured.waist));
  if (tag.inseam != null && measured.inseam != null) diffs.push(Math.abs(tag.inseam - measured.inseam));
  return diffs.some((d) => d >= 2);
}

// Static condition boilerplate — used for BOTH the eBay conditionDescription
// field and the opening of the main item description.
export function getConditionBoilerplate(condition) {
  const boilerplate =
    "Please see all photos for condition as all flaws will be shown throughout the photos! Please review the measurements provided in the photos. It is best to compare our listing's measurements to a similar article of clothing in your closet to ensure a proper fit!";
  if (condition === "NEW_WITH_TAGS") return `New With Tags! ${boilerplate}`;
  if (condition === "NEW_WITHOUT_TAGS") return `New Without Tags! ${boilerplate}`;
  if (condition === "NEW_WITH_DEFECTS") return `New With Defects! ${boilerplate}`;
  return `Pre-owned condition! ${boilerplate}`;
}

// --- Tops ------------------------------------------------------------------
// Shirts, polos, tees, jumpers, hoodies, jackets and coats — everything worn
// above the waist takes the same two measurements, so they share one shape.
// Bottoms are still on the old template below until we design them.
// See docs/Plans/Description Plan.md.

const TOP_WORDS = [
  "shirt", "polo", "tee", "t-shirt", "sweater", "jumper", "hoodie", "sweatshirt",
  "pullover", "jacket", "coat", "vest", "blazer", "cardigan", "henley", "top",
  "quarter zip", "1/4 zip", "flannel", "turtleneck", "parka", "windbreaker",
];

// Bottoms are matched on whole words, because "Short Sleeve Shirt" contains
// "short" and is emphatically not a pair of shorts. Skirts are in neither
// list — no inseam, so they stay on the old template until we design them.
const BOTTOM_RE =
  /\b(pants?|jeans?|shorts|trousers?|chinos?|joggers?|sweatpants?|leggings?|slacks?|khakis?)\b/i;

export function isBottom(observations) {
  return BOTTOM_RE.test(`${observations?.type || ""}`);
}

export function isTop(observations) {
  const type = `${observations?.type || ""}`.toLowerCase();
  if (!type) return false;
  if (isBottom(observations)) return false;
  return TOP_WORDS.some((w) => type.includes(w));
}

const CONDITION_WORDS = {
  NEW_WITH_TAGS: "New with tags",
  NEW_WITHOUT_TAGS: "New without tags",
  NEW_WITH_DEFECTS: "New with defects",
  PRE_OWNED_EXCELLENT: "Pre-owned, excellent",
  PRE_OWNED_GOOD: "Pre-owned, good",
  PRE_OWNED_FAIR: "Pre-owned, fair",
};

// There is no opening sentence. One built from the observation fields read
// like what it was — "Hooded Regular Fit Hooded Flannel Jacket with
// drawstring hood" — and an AI-written one was judged not worth the effort
// for what it adds (users' call 2026-10-05). The title says what the item is.

// The AI's observations bag is free-form, so a measurement turns up under
// whatever key it felt like: chest_measurement_in, chest_measurement_inches,
// or packed into a measured_size string like `Chest 49" / Length 30"`. Look
// everywhere rather than trust one spelling. Returns inches, or null.
export function measurementOf(observations, what) {
  const o = observations || {};
  // 8a: its own named slot, a plain number. Everything below is the old hunt,
  // kept for drafts analyzed before those fields existed.
  const named = namedInches(o, `${what}_in`);
  if (named != null) return named;

  for (const [key, value] of Object.entries(o)) {
    if (!key.toLowerCase().startsWith(what)) continue;
    if (!/measure|_in$|_inches$/i.test(key)) continue;
    const n = Number(String(value).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  // Packed into a sentence: "Chest 49" / Length 30"" or "34 waist, 7 inseam".
  const packed = `${o.measured_size || ""} ${typeof o.measurements === "string" ? o.measurements : ""}`;
  return labelledInches(packed, what);
}

// Flaws are ALWAYS stated — "None" when there are none (users' call
// 2026-09-28). Silence reads as an oversight; a plain "None" is an answer.
// The list comes from the seller's Flaws box on the draft, seeded by the AI
// and corrected by eye, so what's printed here has been looked at.
// The mark on a flaw line the seller still has to write. A white arrow means
// "a real flaw, but I'll word this one myself" (users' call 2026-09-29), so
// the AI never describes it — this placeholder holds its place in the list
// instead, and nothing may post while one is still there.
export const FLAW_TODO = "⚠";

// Anywhere in the line, not just at the start: by the time it reaches the
// description a bullet sits in front of it, and the seller may have typed
// around it. The marker appears nowhere else, so finding it is enough.
export function isFlawTodo(line) {
  return String(line || "").includes(FLAW_TODO);
}

// Does this draft still have a flaw nobody has worded? The post block asks
// this. Clearing it means typing the real flaw, typing None, or deleting the
// line — all three are deliberate, which is all a safety check should want.
export function hasUnwrittenFlaw(lines) {
  return (Array.isArray(lines) ? lines : String(lines || "").split("\n")).some(isFlawTodo);
}

// Seed the Flaws box from the arrows the AI read (8b). One line per entry —
// the AI has already merged same-coloured arrows into a single line. White
// arrows become the placeholder, naming the spot and the photo so the seller
// can find the thing without hunting.
export function flawSeed(flaws) {
  if (!Array.isArray(flaws)) return [];
  return flaws
    .map((f) => {
      if (f?.color === "white") {
        const place = f.where ? `, ${f.where}` : "";
        const shot = f.photo ? ` (AI photo ${f.photo})` : "";
        return `${FLAW_TODO} White arrow${place}${shot} — describe this one`;
      }
      return String(f?.text || "").trim();
    })
    .filter(Boolean);
}

export function flawLines(flaws) {
  const list = (Array.isArray(flaws) ? flaws : String(flaws || "").split("\n"))
    .map((f) => String(f || "").trim())
    .filter(Boolean);
  return list.length ? list : ["None"];
}

// Everything except the measurement line is the same on tops and bottoms, so
// each template works out its own measurements and hands them over.
function buildBody(title, condition, o, flaws, measures) {
  const lines = [];

  lines.push(title || "");
  lines.push("");

  if (measures.length) {
    lines.push("Measurements");
    // Tag size first — it's what the buyer looked for in the title, and the
    // measurements are there to check it against.
    if (o.tag_size) lines.push(`Tag size: ${o.tag_size}`);
    lines.push(measures.join(" · "));
    lines.push("");
  } else if (o.tag_size) {
    // No tape numbers, but the tag size still shows (users' call 2026-09-29).
    // It's the one size fact we have and a buyer shouldn't have to go back up
    // to the title for it. No "Measurements" heading over a line that isn't
    // a measurement.
    lines.push(`Tag size: ${o.tag_size}`);
    lines.push("");
  }

  lines.push(`Condition — ${CONDITION_WORDS[condition] || "Pre-owned"}`);
  const found = flawLines(flaws);
  lines.push(found.length === 1 ? `Flaws: ${found[0]}` : "Flaws:");
  if (found.length > 1) for (const f of found) lines.push(`• ${f}`);
  // One line under the whole list, not one per flaw (users' call 2026-09-29),
  // pointing the buyer at the photos rather than making them wonder.
  if (!(found.length === 1 && found[0] === "None")) {
    lines.push(
      found.length > 1
        ? "Pictures included in the photos."
        : "Picture included in the photos."
    );
  }
  // No seller note goes in here (users' call 2026-09-29). The Draft Note is
  // for whoever finishes the draft and has never gone to eBay — see
  // docs/Plans/AI Notes Plan.md.
  lines.push("");

  lines.push("Ships USPS Ground Advantage");
  if (measures.length) {
    lines.push("Compare these measurements with something in your own wardrobe for the best fit.");
  }
  return lines.join("\n");
}

// The description is stored as plain text so the box on the Create Listing
// page reads cleanly — markup in a field you edit by hand is noise (users'
// call 2026-10-05). The bold goes on here, on the way out to eBay: the title
// line, the Measurements heading and the Condition label.
//
// Matching on the line's own text means a heading the seller has renamed
// simply isn't bolded, which is the right failure. Lines that already carry
// tags — drafts written before this change — are left exactly as they are.
export function htmlForEbay(text) {
  const src = String(text || "");
  if (!src.trim()) return "";
  let seenFirst = false;
  const out = src.split("\n").map((raw) => {
    const line = raw.trimEnd();
    if (!line.trim()) return line;
    // The first line with anything on it is the title — count it even when it
    // already carries tags, or an older draft's title is skipped and the next
    // bare line gets bolded in its place.
    const isTitle = !seenFirst;
    seenFirst = true;
    if (line.includes("<b>")) return line;
    if (isTitle) return `<b>${line}</b>`;
    if (line === "Measurements") return "<b>Measurements</b>";
    const cond = /^(Condition)( — .*)$/.exec(line);
    if (cond) return `<b>${cond[1]}</b>${cond[2]}`;
    return line;
  });
  return out.join("\n").replace(/\n/g, "<br>");
}

// Tops: chest and length. Nothing is estimated — a measurement the AI didn't
// read off the photos simply doesn't appear.
export function buildTopDescription(title, condition, observations, flaws = []) {
  const o = observations || {};
  const chest = measurementOf(o, "chest");
  const length = measurementOf(o, "length");
  const measures = [];
  if (chest) measures.push(`Chest ${chest}"`);
  if (length) measures.push(`Length ${length}"`);
  return buildBody(title, condition, o, flaws, measures);
}

// --- Bottoms ---------------------------------------------------------------
// Waist, rise and inseam — the three the seller measures.
export function bottomMeasures(o) {
  // Named numbers first (8a), then the written size — "32x30" is a shape only
  // parseBottomSize understands — then the old hunt through the whole bag.
  const measured = parseBottomSize(o?.measured_size);
  const waistIn = namedInches(o, "waist_in") ?? measured?.waist ?? measurementOf(o, "waist");
  const inseamIn = namedInches(o, "inseam_in") ?? measured?.inseam ?? measurementOf(o, "inseam");
  const riseIn = measurementOf(o, "rise");

  const parts = [];
  // A letter-sized bottom (M, L, XL) nearly always has a stretch waistband,
  // so the relaxed tape number reads as mismarked and costs the sale. The tag
  // letter is the honest answer for the waist; rise and inseam are fixed
  // cloth and stay in inches (users' call 2026-09-29).
  // Only alongside a real measurement though — "Measurements / Tag size: M /
  // Waist M" says the same thing twice and measures nothing.
  if (o?.tag_size && parseBottomSize(o.tag_size) === null) {
    if (riseIn || inseamIn) parts.push(`Waist ${o.tag_size}`);
  } else if (waistIn) {
    parts.push(`Waist ${waistIn}"`);
  }
  if (riseIn) parts.push(`Rise ${riseIn}"`);
  if (inseamIn) parts.push(`Inseam ${inseamIn}"`);
  return parts;
}

export function buildBottomDescription(title, condition, observations, flaws = []) {
  const o = observations || {};
  return buildBody(title, condition, o, flaws, bottomMeasures(o));
}

// Build the main item description body from template.
export function buildDescription(title, condition, observations) {
  const lines = [];
  lines.push(title || "");
  lines.push("");
  if (checkTwoInchRule(observations)) {
    lines.push(`Tag - ${observations.tag_size}`);
    lines.push(`Measures ${observations.measured_size}`);
    lines.push("");
  }
  lines.push(getConditionBoilerplate(condition));
  lines.push("");
  lines.push("Ships USPS Ground Advantage!");
  return lines.join("\n");
}

// The size that BELONGS in the title, when the 2-inch rule fires: the
// measured size, marked. Returns null when the rule doesn't apply and the
// AI's own size should stand.
//
// The app used to only add an asterisk to whatever size the AI had already
// written, so if the model put the TAG size in the title the rule fired and
// achieved nothing — no asterisk, and the wrong size shown. Deciding it here
// makes it certain rather than instructed.
//
// The shape follows the tag: a tag reading W34 gives "31*", not "31x9*",
// because that's how the size reads on the garment (users' call 2026-09-29).
export function titleSizeOverride(observations) {
  if (!checkTwoInchRule(observations)) return null;
  const tag = parseBottomSize(observations?.tag_size);
  const measured = measuredBottom(observations);
  if (!measured || measured.waist == null) return null;
  return tag?.inseam != null && measured.inseam != null
    ? `${measured.waist}x${measured.inseam}*`
    : `${measured.waist}*`;
}

// Apply the 2-inch-rule asterisk to pant size in a title (e.g. "32x30" →
// "32x30*"). No-op if not a pants item or the rule doesn't apply. Also
// re-truncates to 80 chars if the added asterisk pushed past the limit.
export function applyTwoInchAsterisk(title, observations) {
  if (!title) return title;
  if (!checkTwoInchRule(observations)) return title;
  const measured = measuredBottom(observations);
  if (!measured) return title;

  // The size in the title follows the shape of the TAG, not the tape. A tag
  // reading W32 means the title says "Mens 30", so marking "30x7" would hunt
  // for something that was never there. Only a tag that gave both halves
  // gets a "32x30" in the title.
  const tag = parseBottomSize(observations.tag_size);
  const useBoth =
    tag?.inseam != null && measured.waist != null && measured.inseam != null;

  // With both halves it's an unmistakable "32x30". With a waist alone it's
  // a bare number, which could just as easily be the 7 in "7 Inch Inseam" —
  // so only mark it when that number appears exactly once in the title.
  let sizeStr;
  if (useBoth) {
    sizeStr = `${measured.waist}x${measured.inseam}`;
  } else if (measured.waist != null) {
    const bare = String(measured.waist);
    const hits = (title.match(new RegExp(`\\b${bare}\\b`, "g")) || []).length;
    if (hits !== 1) return title;
    sizeStr = bare;
  } else {
    return title;
  }
  if (!title.includes(sizeStr)) return title;
  // Already applied (the assembled title adds it up front) — don't double it.
  if (title.includes(`${sizeStr}*`)) return title;
  let next = title.replace(new RegExp(`\\b${sizeStr}\\b`), sizeStr + "*");
  if (next.length > 80) next = next.substring(0, 80);
  return next;
}

// One-shot: given a freshly analyzed listing, apply all the description-
// template rules in place. Returns a new listing object.
export function applyDescriptionTemplate(listing) {
  if (!listing) return listing;
  const next = { ...listing };
  if (next.title && next.title.length > 80) {
    next.title = next.title.substring(0, 80);
  }
  next.title = applyTwoInchAsterisk(next.title, next.observations);

  // Tops and bottoms get their own template; anything else — skirts, and
  // whatever isn't clothing — keeps the original one until it is designed.
  // Flaws come from the arrows the AI read (8b); a white arrow arrives as a
  // placeholder the seller must word before the listing will post.
  const obs = next.observations;
  const flaws = flawSeed(next.flaws);
  next.item_description = isTop(obs)
    ? buildTopDescription(next.title, next.condition, obs, flaws)
    : isBottom(obs)
      ? buildBottomDescription(next.title, next.condition, obs, flaws)
      : buildDescription(next.title, next.condition, obs);

  // Always overwrite condition_description with the static boilerplate —
  // the AI's attempt is discarded (decision: we don't trust AI flaw lists).
  next.condition_description = getConditionBoilerplate(next.condition);
  return next;
}
