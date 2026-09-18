// Title assembly + keyword chips — pure logic, no SDK imports, so it is safe
// to use from client components (ListingForm) and server routes alike.
//
// The AI returns title PIECES:
//   titleParts: { nwt, brand, style_name, type, gender, size, color }
//   keywords:   [{ keyword, tier }]   (SEO-ranked, best first)
// and this module builds:
//   title    = base slots + keywords (Tier 1 → 2 → 3) until 80 characters
//   keywords = [{ keyword, tier, placement: "title" | "theme" }]
//
// Invariant: every keyword kept on the listing is PLACED — in the title or in
// the Theme item specific. A keyword that can't be placed anywhere is dropped,
// so the chips never show a keyword that isn't actually used.
//
// Listings without titleParts (existing drafts, or an AI response missing the
// pieces) are left completely untouched.

import { applyTwoInchAsterisk } from "./descriptionTemplate";

export const TITLE_MAX = 80;
export const MAX_KEYWORDS = 10;
export const KEYWORD_MAX_LEN = 30;
// Theme can hold every keyword, so moving chips never has to drop one.
export const THEME_MAX_KEYWORDS = MAX_KEYWORDS;

// Mirrors the banned-word list in titleRules.js — a code-level safety net in
// case the AI slips one through.
const BANNED_WORDS = new Set([
  "cotton", "polyester", "nylon", "spandex", "blend", "stretch",
  "amazing", "rare", "great", "must-have", "awesome",
  "nwt", "nwot", "nwd",
]);

function words(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[\s\-/]+/)
    .filter(Boolean);
}

function cleanPart(value) {
  if (value === null || value === undefined) return "";
  const s = String(value).replace(/\s+/g, " ").trim();
  return s.toLowerCase() === "null" || s.toLowerCase() === "undefined" ? "" : s;
}

export function hasTitleParts(listing) {
  const p = listing?.titleParts;
  return !!(p && (cleanPart(p.brand) || cleanPart(p.type)));
}

// Brand + Style Name + Item Type from the TITLE verbatim, dropping NWT, size,
// gender, color and extras (the eBay research search and the page heading).
//   1. Type-anchor — find observations.type in the title (case- and
//      dash-insensitive) and cut everything after it.
//   2. Stop-word fallback — cut at the first gender word or size.
// "" when there is no title.
export function shortItemName(title, observations) {
  let working = String(title || "").trim().replace(/^NWT\s+/i, "");
  if (!working) return "";

  const type = observations?.type;
  if (type) {
    const typeWords = String(type)
      .toLowerCase()
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (typeWords.length) {
      const typePattern = new RegExp(`\\b${typeWords.join("[\\s-]+")}\\b`, "i");
      const typeMatch = working.match(typePattern);
      if (typeMatch) return working.substring(0, typeMatch.index + typeMatch[0].length).trim();
    }
  }

  // Not inside initials or possessives: "L.L. Bean" isn't size L, "Levi's"
  // isn't size S.
  const stopRegex =
    /(?<![.'’])\b(?:Mens|Womens|Boys|Girls|Unisex|XS|XXS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL|6XL|7XL|Small|Medium|Large|X-Small|X-Large|XX-Large|XXX-Large|\d{2}x\d{2}\*?)\b(?![.'’])/i;
  const stopMatch = working.match(stopRegex);
  if (stopMatch) working = working.substring(0, stopMatch.index).trim();
  return working;
}

// Fixed part of the title: [NWT] Brand [Style Name] Item Type Gender Size Color
export function buildBaseTitle(parts, observations) {
  if (!parts) return "";
  const base = [
    parts.nwt ? "NWT" : "",
    cleanPart(parts.brand),
    cleanPart(parts.style_name),
    cleanPart(parts.type),
    cleanPart(parts.gender),
    cleanPart(parts.size),
    cleanPart(parts.color),
  ]
    .filter(Boolean)
    .join(" ");
  const withAsterisk = applyTwoInchAsterisk(base, observations);
  return withAsterisk.length > TITLE_MAX
    ? withAsterisk.slice(0, TITLE_MAX).trim()
    : withAsterisk;
}

// Clean the AI's keyword list:
//   1. trim, drop too-long keywords and anything with a banned word
//   2. sort by tier, keeping the AI's best-first order within a tier
//   3. strip words that already appear in the base slots or in a
//      higher-ranked keyword ("Sun Shirt" on a T-Shirt → "Sun"). eBay search
//      matches words anywhere in the title, so the shorter keyword still
//      matches the same searches and saves room for more keywords.
//   4. drop keywords left empty, dedupe, cap the count
export function normalizeKeywords(raw, parts) {
  if (!Array.isArray(raw)) return [];
  const candidates = [];
  raw.forEach((item, order) => {
    const text = typeof item === "string" ? item : item?.keyword;
    const keyword = cleanPart(text);
    if (!keyword || keyword.length > KEYWORD_MAX_LEN) return;
    const kw = words(keyword);
    if (kw.length === 0 || kw.some((w) => BANNED_WORDS.has(w))) return;
    let tier = Number(item?.tier);
    if (![1, 2, 3].includes(tier)) tier = 3;
    candidates.push({ keyword, tier, order });
  });
  candidates.sort((a, b) => a.tier - b.tier || a.order - b.order);

  const usedWords = new Set(
    words(
      [parts?.brand, parts?.style_name, parts?.type, parts?.gender, parts?.size, parts?.color]
        .map(cleanPart)
        .join(" ")
    )
  );
  const out = [];
  for (const c of candidates) {
    // Keep original casing/punctuation; remove only tokens already used.
    const kept = c.keyword
      .split(/\s+/)
      .filter((token) => {
        const tokenWords = words(token);
        return tokenWords.length > 0 && !tokenWords.every((w) => usedWords.has(w));
      })
      .join(" ")
      .trim();
    if (!kept) continue;
    words(kept).forEach((w) => usedWords.add(w));
    out.push({ keyword: kept, tier: c.tier });
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

export function composeTitle(base, keywords) {
  return [base, ...(keywords || []).filter((k) => k.placement === "title").map((k) => k.keyword)]
    .filter(Boolean)
    .join(" ");
}

// Initial placement: add keywords best-first while they fit in 80 chars; the
// rest overflow to Theme. Without a Theme field, overflow is dropped.
export function placeKeywords(base, keywords, { hasTheme = true } = {}) {
  let title = base;
  let themeCount = 0;
  const placed = [];
  for (const k of keywords) {
    const candidate = title ? `${title} ${k.keyword}` : k.keyword;
    if (candidate.length <= TITLE_MAX) {
      title = candidate;
      placed.push({ keyword: k.keyword, tier: k.tier, placement: "title" });
    } else if (hasTheme && themeCount < THEME_MAX_KEYWORDS) {
      placed.push({ keyword: k.keyword, tier: k.tier, placement: "theme" });
      themeCount++;
    }
  }
  return { title, keywords: placed };
}

// Assemble title + keyword placement for a freshly analyzed listing. Returns
// the listing unchanged when it has no titleParts (safe for old drafts).
export function assembleListingTitle(listing, { hasTheme = true } = {}) {
  if (!hasTitleParts(listing)) return listing;
  const base = buildBaseTitle(listing.titleParts, listing.observations);
  const normalized = normalizeKeywords(listing.keywords, listing.titleParts);
  const { title, keywords } = placeKeywords(base, normalized, { hasTheme });
  return { ...listing, title, keywords };
}

// Chip click on a Theme keyword → move it into the title. If it doesn't fit,
// bump the lowest-ranked title keyword(s) to Theme. If it can't fit even
// alone, nothing changes (ok: false).
export function moveKeywordToTitle(base, keywords, index) {
  const next = (keywords || []).map((k) => ({ ...k }));
  const target = next[index];
  if (!target || target.placement === "title") {
    return { ok: true, title: composeTitle(base, next), keywords: next };
  }
  target.placement = "title";
  while (composeTitle(base, next).length > TITLE_MAX) {
    let bump = -1;
    for (let i = next.length - 1; i >= 0; i--) {
      if (i !== index && next[i].placement === "title") {
        bump = i;
        break;
      }
    }
    if (bump === -1) {
      return { ok: false, title: composeTitle(base, keywords), keywords };
    }
    next[bump].placement = "theme";
  }
  return { ok: true, title: composeTitle(base, next), keywords: next };
}

// Chip click on a title keyword → move it to Theme, then refill the title
// with the best other Theme keywords that fit (never the one just moved).
export function moveKeywordToTheme(base, keywords, index, { hasTheme = true } = {}) {
  const next = (keywords || []).map((k) => ({ ...k }));
  const target = next[index];
  if (!hasTheme || !target || target.placement === "theme") {
    return { ok: hasTheme, title: composeTitle(base, keywords), keywords };
  }
  target.placement = "theme";
  for (let i = 0; i < next.length; i++) {
    if (i === index || next[i].placement !== "theme") continue;
    next[i].placement = "title";
    if (composeTitle(base, next).length > TITLE_MAX) next[i].placement = "theme";
  }
  return { ok: true, title: composeTitle(base, next), keywords: next };
}

export function themeKeywordValues(keywords) {
  return (keywords || []).filter((k) => k.placement === "theme").map((k) => k.keyword);
}

// Build the Theme value: any Theme values the user added by hand (not
// keywords) are kept, then the overflow keywords. Returns "" when empty.
export function mergeTheme(existingTheme, keywords) {
  const keywordSet = new Set((keywords || []).map((k) => k.keyword.toLowerCase()));
  const existing = Array.isArray(existingTheme)
    ? existingTheme
    : existingTheme
      ? [existingTheme]
      : [];
  const manual = existing.filter((v) => !keywordSet.has(String(v).toLowerCase()));
  const merged = [...manual, ...themeKeywordValues(keywords)];
  return merged.length > 0 ? merged : "";
}

// After the category's item specifics are known: put overflow keywords in
// Theme, or — when the category has no Theme field — drop them so no chip is
// left unplaced. Listings without keywords are returned untouched.
export function applyKeywordTheme({ keywords, itemSpecifics, hasTheme }) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return { keywords, itemSpecifics };
  }
  if (!hasTheme) {
    return {
      keywords: keywords.filter((k) => k.placement === "title"),
      itemSpecifics,
    };
  }
  const next = { ...(itemSpecifics || {}) };
  const theme = mergeTheme([], keywords);
  if (theme === "") delete next.Theme;
  else next.Theme = theme;
  return { keywords, itemSpecifics: next };
}

// Keep the description's first line (the title line) matching the title.
// Nothing else in the description changes. Empty descriptions are left alone.
export function syncDescriptionTitle(description, title) {
  if (!description) return description;
  const lines = String(description).split("\n");
  lines[0] = title || "";
  return lines.join("\n");
}
