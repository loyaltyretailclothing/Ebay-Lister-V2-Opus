import {
  analyzeListing,
  applyDescriptionTemplate,
  fetchCategorySpecifics,
  fillItemSpecifics,
  lookupCategory,
  refineStyleName,
} from "./listingPipeline";
import { applyKeywordTheme } from "./titleKeywords";

// The whole analysis, start to finish, on the spot. One copy, used by the
// camera route, by "Analyze now" on a queued draft, and by the fallback when
// Anthropic's queue lets a draft down — so those three can never drift apart.
//
// Photos in, a finished listing out. Throws only when there is nothing worth
// keeping (the AI couldn't identify the item); a failed refine or category
// lookup is logged and skipped, because a draft with a title is still worth
// having and the category can be fixed by hand.
export async function analyzeDraftLive({ analysisPhotos, aiNote, draftNote, tally }) {
  const listing = await analyzeListing(analysisPhotos, aiNote, tally);

  // Empty title = Claude couldn't make sense of the photos (wrong subject,
  // blurry, bad lighting). Technically the pipeline "succeeded" but there's
  // nothing to list, so surface it as an error row instead of a silent
  // "Untitled" draft the user has to open to realize was useless.
  if (!listing?.title || !listing.title.trim()) {
    throw new Error(
      "AI couldn't identify the item — retry with clearer photos of clothing/items."
    );
  }

  // Brave refine (best-effort) — runs BEFORE specifics so Pass 2 sees the
  // final refined title. The SPECIFICS prompt uses the title to decide which
  // SEO keywords to push into Theme; refining first keeps this flow in
  // lockstep with the Generate page.
  try {
    const refined = await refineStyleName(listing, tally);
    if (refined) Object.assign(listing, refined);
  } catch (refineErr) {
    console.error("Refine step failed:", refineErr);
  }

  // Category + specifics (best-effort — continue without if this fails).
  try {
    const cat = await lookupCategory(listing.category_keywords);
    if (cat) {
      listing.categoryId = cat.categoryId;
      listing.categoryName = cat.categoryName;
      const specificsSchema = await fetchCategorySpecifics(cat.categoryId);
      const hasKeywords = Array.isArray(listing.keywords) && listing.keywords.length > 0;
      const filled = await fillItemSpecifics(
        listing.observations,
        specificsSchema,
        listing.title,
        { themeManaged: hasKeywords, tally }
      );
      // Overflow keywords → Theme; if this category has no Theme field, drop
      // them so no keyword chip is left unplaced.
      const applied = applyKeywordTheme({
        keywords: listing.keywords,
        itemSpecifics: filled,
        hasTheme: specificsSchema.some((s) => s.name === "Theme"),
      });
      listing.itemSpecifics = applied.itemSpecifics;
      listing.keywords = applied.keywords;
    }
  } catch (catErr) {
    console.error("Category/specifics step failed:", catErr);
  }

  // The description template runs LAST so the final title (post-refine) is
  // the one that lands in the description body.
  Object.assign(listing, applyDescriptionTemplate(listing));

  // Notes persist on the draft. aiNote is kept for reference and
  // re-analysis; draftNote is the internal reviewer note. The publish route
  // only reads the fields it needs, so neither reaches eBay.
  listing.aiNote = aiNote || "";
  listing.draftNote = draftNote || "";
  return listing;
}
