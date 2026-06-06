// Single source of truth for item conditions.
//
// Previously the condition list lived in two disconnected places: a
// hardcoded <select> in ListingForm.js and a CONDITION_MAP in the publish
// route. They could drift. This module centralizes the canonical list so
// both the form (enum -> label, filter by category) and the publish route
// (enum -> eBay condition + conditionId) read from one definition.
//
// Each entry:
//   key          - our internal enum (stored on the listing/draft)
//   condition    - eBay Inventory API `condition` enum string
//   conditionId  - eBay numeric condition ID (overrides at publish time)
//   label        - human label shown in the form dropdown
//   group        - "new" | "preowned" — used to pick a same-family fallback
//                  when a category doesn't support the exact condition

export const CONDITIONS = [
  { key: "NEW_WITH_TAGS",       condition: "NEW",              conditionId: "1000", label: "New With Tags",        group: "new" },
  { key: "NEW_WITHOUT_TAGS",    condition: "NEW_OTHER",        conditionId: "1500", label: "New Without Tags",     group: "new" },
  { key: "NEW_WITH_DEFECTS",    condition: "NEW_WITH_DEFECTS", conditionId: "1750", label: "New With Defects",     group: "new" },
  { key: "PRE_OWNED_EXCELLENT", condition: "PRE_OWNED_EXCELLENT", conditionId: "2990", label: "Pre-Owned - Excellent", group: "preowned" },
  { key: "PRE_OWNED_GOOD",      condition: "USED_EXCELLENT",      conditionId: "3000", label: "Pre-Owned - Good",      group: "preowned" },
  { key: "PRE_OWNED_FAIR",      condition: "PRE_OWNED_FAIR",      conditionId: "3010", label: "Pre-Owned - Fair",      group: "preowned" },
];

// enum key -> full definition. Back-compat: the publish route imports this
// and reads .condition / .conditionId exactly as it did with its old local
// CONDITION_MAP object.
export const CONDITION_MAP = Object.fromEntries(
  CONDITIONS.map((c) => [c.key, c])
);

// Given the conditionIds eBay says a category allows, return the subset of
// our CONDITIONS that map to those IDs (preserving canonical order). If the
// allowed list is empty/unknown (e.g. the metadata lookup failed), return
// ALL conditions so the form degrades gracefully to its old behavior.
export function allowedConditionsForCategory(allowedIds) {
  if (!Array.isArray(allowedIds) || allowedIds.length === 0) return CONDITIONS;
  const set = new Set(allowedIds.map(String));
  return CONDITIONS.filter((c) => set.has(c.conditionId));
}

// If `currentKey` isn't valid for the category, pick the best replacement:
//   1. keep it if it's still allowed (no change)
//   2. otherwise prefer a condition in the SAME group (a pre-owned item
//      stays pre-owned, a new item stays new)
//   3. otherwise fall back to the first allowed condition
// Returns the chosen enum key (or the original/"" if nothing is allowed).
export function reconcileCondition(currentKey, allowedConditions) {
  if (!allowedConditions || allowedConditions.length === 0) {
    return currentKey || "";
  }
  if (currentKey && allowedConditions.some((c) => c.key === currentKey)) {
    return currentKey;
  }
  const def = currentKey ? CONDITION_MAP[currentKey] : null;
  if (def) {
    const sameGroup = allowedConditions.find((c) => c.group === def.group);
    if (sameGroup) return sameGroup.key;
  }
  return allowedConditions[0].key;
}
