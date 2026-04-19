// Pure description-template helpers — safe to import from client components.
//
// These were originally in listingPipeline.js, but that module pulls in the
// Anthropic SDK and eBay API helpers at the top level, which breaks when
// bundled into the browser. Keeping these in their own dependency-free file
// lets the Generate page (a client component) share the exact same logic the
// Camera server pipeline uses.

// Parse "32x30" or "32 x 30" into [waist, inseam] numbers, or null.
export function parsePantSize(sizeStr) {
  if (!sizeStr) return null;
  const match = String(sizeStr).match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

// 2-inch rule: for pants/shorts/jeans, if tag vs measured waist OR inseam
// differ by 2+ inches, surface both in the description so buyers know the
// real fit.
export function checkTwoInchRule(observations) {
  const itemType = (observations?.type || "").toLowerCase();
  const isPants = ["pants", "jeans", "shorts", "trousers", "chinos"].some((t) =>
    itemType.includes(t)
  );
  if (!isPants) return false;
  const tag = parsePantSize(observations?.tag_size);
  const measured = parsePantSize(observations?.measured_size);
  if (!tag || !measured) return false;
  const waistDiff = Math.abs(tag[0] - measured[0]);
  const inseamDiff = Math.abs(tag[1] - measured[1]);
  return waistDiff >= 2 || inseamDiff >= 2;
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

// Apply the 2-inch-rule asterisk to pant size in a title (e.g. "32x30" →
// "32x30*"). No-op if not a pants item or the rule doesn't apply. Also
// re-truncates to 80 chars if the added asterisk pushed past the limit.
export function applyTwoInchAsterisk(title, observations) {
  if (!title) return title;
  if (!checkTwoInchRule(observations)) return title;
  const measured = parsePantSize(observations.measured_size);
  if (!measured) return title;
  const sizeStr = `${measured[0]}x${measured[1]}`;
  if (!title.includes(sizeStr)) return title;
  let next = title.replace(sizeStr, sizeStr + "*");
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
