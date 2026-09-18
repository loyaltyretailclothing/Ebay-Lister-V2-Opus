"use client";

import { useState, useEffect } from "react";
import {
  CONDITIONS,
  allowedConditionsForCategory,
  reconcileCondition,
} from "@/lib/conditions";
import {
  applyKeywordTheme,
  buildBaseTitle,
  hasTitleParts,
  mergeTheme,
  moveKeywordToTheme,
  moveKeywordToTitle,
  syncDescriptionTitle,
} from "@/lib/titleKeywords";
import { cachedCategories, cachedSpecifics, getCategories, getSpecifics } from "@/lib/ebayCache";

// The listing form's logic (moved unchanged out of the old ListingForm so
// the desktop and phone layouts share it): category suggestions, item
// specifics + the AI fill (Pass 2), condition rules per category, policy
// defaults, keyword chips and title ↔ description sync.
//
// `onUser` is for changes the user makes; `onAuto` for changes the form
// makes by itself. Both drop changes from an old session (see
// useListingEditor), so this hook must be mounted once per session.
// Minimum offer = 25% off the price, rounded to cents. Only while the user
// hasn't typed their own: a draft that already has a minimum offer (saved
// before this existed) keeps it.
const MIN_OFFER_FACTOR = 0.75;
function autoMinOffer(listing, price) {
  const manual =
    listing.minOfferManual === true ||
    (listing.minOfferManual === undefined && String(listing.minOffer || "").trim() !== "");
  if (manual) return {};
  const p = parseFloat(price);
  return {
    minOffer: Number.isFinite(p) && p > 0 ? (Math.round(p * MIN_OFFER_FACTOR * 100) / 100).toFixed(2) : "",
    minOfferManual: false,
  };
}

export default function useListingForm(listing, { onUser, onAuto, getSettings, peekSettings }) {
  // Start from whatever is already cached (the editor fetches a draft's
  // item specifics before swapping it in), so the form appears complete in
  // one step instead of filling in piece by piece.
  const initSpec = cachedSpecifics(listing?.categoryId);
  const initSettings = peekSettings?.();
  const [categories, setCategories] = useState(
    () => cachedCategories(listing?.category_keywords)?.categories || []
  );
  const [specifics, setSpecifics] = useState(() => initSpec?.specifics || []);
  // Conditions the current category allows. Defaults to all conditions so
  // the dropdown is fully populated before a category is chosen and as a
  // graceful fallback if the eBay condition lookup fails.
  const [allowedConditions, setAllowedConditions] = useState(() =>
    initSpec ? allowedConditionsForCategory(initSpec.conditionIds || []) : CONDITIONS
  );
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSpecifics, setLoadingSpecifics] = useState(() => !!listing?.categoryId && !initSpec);
  const [fillingSpecifics, setFillingSpecifics] = useState(false);
  const [settingsConfig, setSettingsConfig] = useState(() => initSettings?.categories || {});
  const [initialSettingsConfig, setInitialSettingsConfig] = useState(() => initSettings?.categories || {});
  const [settingsLoaded, setSettingsLoaded] = useState(() => !!initSettings?.success);
  const [policies, setPolicies] = useState(() => initSettings?.policies || {});
  const [keywordNotice, setKeywordNotice] = useState("");

  // Settings (saved categories + policies) are loaded once per page by the
  // editor; every session's form waits on that same load.
  useEffect(() => {
    let alive = true;
    getSettings().then((data) => {
      if (!alive || !data?.success) return;
      setSettingsConfig(data.categories || {});
      setInitialSettingsConfig(data.categories || {});
      setPolicies(data.policies || {});
      setSettingsLoaded(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch category suggestions when keywords change
  useEffect(() => {
    if (!listing?.category_keywords) return;

    async function fetchCategories() {
      const cached = !!cachedCategories(listing.category_keywords);
      if (!cached) setLoadingCategories(true);
      try {
        const data = await getCategories(listing.category_keywords);
        if (data?.success) {
          setCategories(data.categories);
          if (data.categories.length > 0 && !listing.categoryId) {
            onAuto({
              ...listing,
              categoryId: data.categories[0].id,
              categoryName: data.categories[0].name,
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      } finally {
        setLoadingCategories(false);
      }
    }

    fetchCategories();
    // analysisRun: re-run after every analysis (including re-analyzing a
    // draft) even when the AI returns the same category keywords.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.category_keywords, listing?.analysisRun]);

  // Fetch item specifics when category changes, then trigger Pass 2
  useEffect(() => {
    if (!listing?.categoryId) return;

    const currentListing = listing;

    async function fetchSpecifics() {
      if (!cachedSpecifics(currentListing.categoryId)) setLoadingSpecifics(true);
      try {
        const data = await getSpecifics(currentListing.categoryId);
        if (data?.success) {
          setSpecifics(data.specifics);

          // Filter the condition dropdown to what this category supports,
          // and auto-correct the saved condition if it's no longer valid.
          const allowed = allowedConditionsForCategory(data.conditionIds || []);
          setAllowedConditions(allowed);
          const reconciledCondition = reconcileCondition(
            currentListing.condition,
            allowed
          );

          // Wait for the saved settings before deciding anything from them.
          const settingsData = await getSettings();
          const savedCategories = settingsData?.success ? settingsData.categories || {} : null;

          // Auto-add the category to Settings if it isn't saved yet. The
          // server only ADDS it; it can never replace the other categories.
          if (savedCategories && !savedCategories[currentListing.categoryId]) {
            const specificsConfig = {};
            for (const spec of data.specifics) {
              specificsConfig[spec.name] = {
                localizedName: spec.localizedName,
                multiSelect: false,
                required: spec.required,
                hasValues: spec.values.length > 0,
              };
            }
            const catName = currentListing.categoryName || "Unknown";
            const config = { name: catName, path: catName, specifics: specificsConfig };
            setSettingsConfig((prev) => ({ ...prev, [currentListing.categoryId]: config }));
            fetch("/api/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ addCategory: { id: currentListing.categoryId, config } }),
            }).catch(() => {});
          }

          // Does this category have a Theme field? Overflow keywords go there;
          // without one, overflow keywords are dropped so no chip is unplaced.
          const categoryHasTheme = data.specifics.some((s) => s.name === "Theme");
          const hasKeywords =
            Array.isArray(currentListing.keywords) &&
            currentListing.keywords.length > 0;

          // Pass 2: AI fills specifics — skip if already populated (e.g. loaded from draft)
          const hasSavedSpecifics =
            currentListing.itemSpecifics &&
            Object.keys(currentListing.itemSpecifics).length > 0;
          let conditionApplied = false;
          if (currentListing.observations && !hasSavedSpecifics) {
            setFillingSpecifics(true);
            try {
              const pass2Res = await fetch("/api/generate/specifics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  observations: currentListing.observations,
                  specifics: data.specifics,
                  title: currentListing.title,
                  themeManaged: hasKeywords,
                }),
              });
              const pass2Data = await pass2Res.json();
              if (pass2Data.success && pass2Data.specifics) {
                // Split comma-separated strings into arrays for multi-select fields
                const catConfig = savedCategories?.[currentListing.categoryId];
                const cleaned = { ...pass2Data.specifics };
                if (catConfig?.specifics) {
                  for (const [key, val] of Object.entries(cleaned)) {
                    if (
                      catConfig.specifics[key]?.multiSelect &&
                      typeof val === "string" &&
                      val.includes(",")
                    ) {
                      cleaned[key] = val.split(",").map((s) => s.trim()).filter(Boolean);
                    }
                  }
                }
                // Overflow keywords → Theme (no-op for listings without keywords).
                const applied = applyKeywordTheme({
                  keywords: currentListing.keywords,
                  itemSpecifics: cleaned,
                  hasTheme: categoryHasTheme,
                });
                // Fold the reconciled condition into the same update so it
                // isn't clobbered by this spread of the captured listing.
                onAuto({
                  ...currentListing,
                  condition: reconciledCondition,
                  itemSpecifics: applied.itemSpecifics,
                  keywords: applied.keywords,
                });
                conditionApplied = true;
              }
            } catch (err) {
              console.error("Pass 2 specifics fill failed:", err);
            } finally {
              setFillingSpecifics(false);
            }
          }

          // Apply the condition correction if Pass 2 didn't already fold it
          // in. Also drop Theme-placed keywords if the category has no Theme
          // field (e.g. the user switched categories on a draft with keywords).
          const unplacedKeywords =
            hasKeywords &&
            !categoryHasTheme &&
            currentListing.keywords.some((k) => k.placement === "theme");
          if (
            !conditionApplied &&
            (reconciledCondition !== currentListing.condition || unplacedKeywords)
          ) {
            onAuto({
              ...currentListing,
              condition: reconciledCondition,
              ...(unplacedKeywords
                ? {
                    keywords: currentListing.keywords.filter(
                      (k) => k.placement === "title"
                    ),
                  }
                : {}),
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch specifics:", err);
      } finally {
        setLoadingSpecifics(false);
      }
    }

    fetchSpecifics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.categoryId]);

  // Auto-fill policies once the policies config loads. Order of preference:
  //   1. User's manually picked value (never overwritten)
  //   2. Saved default (starred in Settings → Policies)
  //   3. The only available option (when a list has exactly one policy)
  const defaultShipping = policies.defaultShipping || "";
  const defaultPayment = policies.defaultPayment || "";
  const defaultReturn = policies.defaultReturn || "";
  const onlyShipping =
    Array.isArray(policies.shipping) && policies.shipping.length === 1
      ? policies.shipping[0].id
      : "";
  const onlyPayment =
    Array.isArray(policies.payment) && policies.payment.length === 1
      ? policies.payment[0].id
      : "";
  const onlyReturn =
    Array.isArray(policies.return) && policies.return.length === 1
      ? policies.return[0].id
      : "";
  const targetShipping = defaultShipping || onlyShipping;
  const targetPayment = defaultPayment || onlyPayment;
  const targetReturn = defaultReturn || onlyReturn;
  useEffect(() => {
    if (!listing) return;
    if (!targetShipping && !targetPayment && !targetReturn) return;
    const updates = {};
    if (!listing.shippingPolicyId && targetShipping) updates.shippingPolicyId = targetShipping;
    if (!listing.paymentPolicyId && targetPayment) updates.paymentPolicyId = targetPayment;
    if (!listing.returnPolicyId && targetReturn) updates.returnPolicyId = targetReturn;
    if (Object.keys(updates).length > 0) onAuto({ ...listing, ...updates });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetShipping, targetPayment, targetReturn]);

  function handleChange(field, value) {
    // Minimum offer follows the price (25% off) until the user types their
    // own. Clearing the box hands it back to the automatic value.
    if (field === "price") {
      onUser({ ...listing, price: value, ...autoMinOffer(listing, value) });
      return;
    }
    if (field === "minOffer") {
      onUser({ ...listing, minOffer: value, minOfferManual: String(value).trim() !== "" });
      return;
    }
    onUser({ ...listing, [field]: value });
  }

  // Until the category's specifics load, assume Theme exists (true for all
  // common clothing categories).
  const categoryHasTheme =
    specifics.length === 0 || specifics.some((s) => s.name === "Theme");

  function handleSpecificChange(name, value) {
    const updated = { ...listing.itemSpecifics, [name]: value };
    // If a Theme keyword is removed by hand in the Theme picker, remove its
    // chip too — every chip must stay placed in the title or Theme.
    if (name === "Theme" && Array.isArray(listing.keywords) && listing.keywords.length > 0) {
      const themeNow = new Set(
        (Array.isArray(value) ? value : value ? [value] : []).map((v) =>
          String(v).toLowerCase()
        )
      );
      const keywords = listing.keywords.filter(
        (k) => k.placement !== "theme" || themeNow.has(k.keyword.toLowerCase())
      );
      onUser({ ...listing, itemSpecifics: updated, keywords });
      return;
    }
    handleChange("itemSpecifics", updated);
  }

  // Typing in the title keeps the description's title line in sync.
  function handleTitleChange(value) {
    onUser({
      ...listing,
      title: value,
      item_description: syncDescriptionTitle(listing.item_description, value),
    });
  }

  // Keyword chip click: move between title and Theme, rebuild the title,
  // update Theme, and sync the description's title line.
  function handleKeywordToggle(index) {
    const keyword = listing.keywords?.[index];
    if (!keyword || !hasTitleParts(listing)) return;
    const base = buildBaseTitle(listing.titleParts, listing.observations);
    const result =
      keyword.placement === "title"
        ? moveKeywordToTheme(base, listing.keywords, index, { hasTheme: categoryHasTheme })
        : moveKeywordToTitle(base, listing.keywords, index);

    if (!result.ok) {
      setKeywordNotice(`"${keyword.keyword}" is too long to fit in the title.`);
      return;
    }
    setKeywordNotice("");

    // Only write Theme once item specifics exist. Before that, the item
    // specifics fill applies Theme from the keywords itself.
    let itemSpecifics = listing.itemSpecifics;
    if (itemSpecifics && Object.keys(itemSpecifics).length > 0) {
      itemSpecifics = { ...itemSpecifics };
      const theme = mergeTheme(itemSpecifics.Theme, result.keywords);
      if (theme === "") delete itemSpecifics.Theme;
      else itemSpecifics.Theme = theme;
    }

    onUser({
      ...listing,
      title: result.title,
      keywords: result.keywords,
      itemSpecifics,
      item_description: syncDescriptionTitle(listing.item_description, result.title),
    });
  }

  function handleCategoryChange(categoryId) {
    const cat = categories.find((c) => c.id === categoryId);
    onUser({
      ...listing,
      categoryId,
      categoryName: cat?.name || "",
      itemSpecifics: {},
    });
  }

  const isNewCategory =
    settingsLoaded && !!listing.categoryId && !initialSettingsConfig[listing.categoryId];
  const skuMissing = !String(listing.sku || "").trim();
  const catConfig = settingsConfig[listing.categoryId];
  const isMulti = (name) => catConfig?.specifics?.[name]?.multiSelect || false;

  return {
    categories,
    specifics,
    requiredSpecifics: specifics.filter((s) => s.required),
    additionalSpecifics: specifics.filter((s) => !s.required),
    allowedConditions,
    loadingCategories,
    loadingSpecifics,
    fillingSpecifics,
    keywordNotice,
    categoryHasTheme,
    isNewCategory,
    skuMissing,
    isMulti,
    countryOfManufacture: listing.itemSpecifics?.["Country/Region of Manufacture"] || "",
    shippingPolicies: Array.isArray(policies.shipping) ? policies.shipping : [],
    paymentPolicies: Array.isArray(policies.payment) ? policies.payment : [],
    returnPolicies: Array.isArray(policies.return) ? policies.return : [],
    handleChange,
    handleSpecificChange,
    handleTitleChange,
    handleKeywordToggle,
    handleCategoryChange,
  };
}
