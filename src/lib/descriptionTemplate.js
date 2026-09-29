// Pure description-template helpers — safe to import from client components.
//
// These were originally in listingPipeline.js, but that module pulls in the
// Anthropic SDK and eBay API helpers at the top level, which breaks when
// bundled into the browser. Keeping these in their own dependency-free file
// lets the Generate page (a client component) share the exact same logic the
// Camera server pipeline uses.

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

  const waist = /waist\D{0,6}(\d{1,2}(?:\.\d)?)/i.exec(s);
  const inseam = /inseam\D{0,6}(\d{1,2}(?:\.\d)?)/i.exec(s);
  if (waist || inseam) {
    return {
      waist: waist ? Number(waist[1]) : null,
      inseam: inseam ? Number(inseam[1]) : null,
    };
  }

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

// 2-inch rule: for pants/shorts/jeans, if tag vs measured waist OR inseam
// differ by 2+ inches, surface both in the description so buyers know the
// real fit.
export function checkTwoInchRule(observations) {
  const itemType = (observations?.type || "").toLowerCase();
  const isBottom = ["pants", "jeans", "shorts", "trousers", "chinos"].some((t) =>
    itemType.includes(t)
  );
  if (!isBottom) return false;
  const tag = parseBottomSize(observations?.tag_size);
  const measured = parseBottomSize(observations?.measured_size);
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
  const measured = parseBottomSize(observations?.measured_size);
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
  const measured = parseBottomSize(observations.measured_size);
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
  next.item_description = buildDescription(
    next.title,
    next.condition,
    next.observations
  );
  // Always overwrite condition_description with the static boilerplate —
  // the AI's attempt is discarded (decision: we don't trust AI flaw lists).
  next.condition_description = getConditionBoilerplate(next.condition);
  return next;
}
