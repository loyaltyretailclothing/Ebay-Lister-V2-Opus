# Conditions by Category

**Status: FIXED.** See [[Publishing to eBay]].

## Symptom
Error #25021: "The provided condition id is invalid for the selected primary category id." Seen on a jersey listed as Pre-Owned - Excellent.

## Cause
eBay's tiered pre-owned conditions (Excellent 2990, Good 3000, Fair 3010) aren't available in every category. Some categories (e.g. jerseys) don't accept 2990/3010. The condition dropdown used to show all six options everywhere.

## Fix
- `src/lib/conditions.js` is the single source of truth: our key → eBay condition, condition ID, label, group (new / preowned). Used by both the form and the publish route.
- `fetchCategoryConditions()` calls eBay's `get_item_condition_policies`. `/api/ebay/specifics` returns `{ specifics, conditionIds }` fetched together.
- The form's dropdown shows only allowed conditions. If a saved condition isn't allowed, it switches to one in the same group (pre-owned stays pre-owned). This also fixes old drafts when they're opened, with no AI cost.
- If the lookup fails, all conditions are shown (old behavior).

## Mapping
| Our key | eBay condition | ID |
|---|---|---|
| NEW_WITH_TAGS | NEW | 1000 |
| NEW_WITHOUT_TAGS | NEW_OTHER | 1500 |
| NEW_WITH_DEFECTS | NEW_WITH_DEFECTS | 1750 |
| PRE_OWNED_EXCELLENT | PRE_OWNED_EXCELLENT | 2990 |
| PRE_OWNED_GOOD | USED_EXCELLENT | 3000 |
| PRE_OWNED_FAIR | PRE_OWNED_FAIR | 3010 |

Note: PRE_OWNED_GOOD sends the enum string `USED_EXCELLENT` with ID 3000. It works because the ID takes precedence, but the naming is inconsistent.
