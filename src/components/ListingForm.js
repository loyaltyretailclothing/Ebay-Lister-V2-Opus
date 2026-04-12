"use client";

import { useState, useEffect } from "react";
import { DEFAULTS } from "@/lib/constants";

// Map AI response fields to common eBay item specific names
const AI_TO_EBAY_MAP = {
  brand: "Brand",
  size: "Size",
  color: "Color",
  gender: "Department",
  material: "Material",
  country_of_manufacture: "Country/Region of Manufacture",
  style: "Style",
  type: "Type",
};

export default function ListingForm({ listing, onListingChange }) {
  const [categories, setCategories] = useState([]);
  const [specifics, setSpecifics] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSpecifics, setLoadingSpecifics] = useState(false);

  // Fetch category suggestions when keywords change
  useEffect(() => {
    if (!listing?.category_keywords) return;

    async function fetchCategories() {
      setLoadingCategories(true);
      try {
        const res = await fetch(
          `/api/ebay/categories?q=${encodeURIComponent(listing.category_keywords)}`
        );
        const data = await res.json();
        if (data.success) {
          setCategories(data.categories);
          // Auto-select first category if none selected
          if (data.categories.length > 0 && !listing.categoryId) {
            onListingChange({
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
  }, [listing?.category_keywords]);

  // Fetch item specifics when category changes
  useEffect(() => {
    if (!listing?.categoryId) return;

    // Capture current listing values for auto-fill
    const currentListing = listing;

    async function fetchSpecifics() {
      setLoadingSpecifics(true);
      try {
        const res = await fetch(
          `/api/ebay/specifics?categoryId=${currentListing.categoryId}`
        );
        const data = await res.json();
        if (data.success) {
          setSpecifics(data.specifics);

          // Auto-populate item specifics from AI data
          const autoFilled = { ...(currentListing.itemSpecifics || {}) };
          for (const [aiField, ebayName] of Object.entries(AI_TO_EBAY_MAP)) {
            if (currentListing[aiField] && !autoFilled[ebayName]) {
              // Only populate if this specific actually exists for this category
              const spec = data.specifics.find((s) => s.name === ebayName);
              if (spec) {
                if (spec.values.length > 0) {
                  // For dropdowns, try case-insensitive match
                  const aiVal = currentListing[aiField].toLowerCase();
                  const match = spec.values.find(
                    (v) => v.toLowerCase() === aiVal
                  );
                  if (match) autoFilled[ebayName] = match;
                } else {
                  // Free text — use AI value directly
                  autoFilled[ebayName] = currentListing[aiField];
                }
              }
            }
          }

          if (Object.keys(autoFilled).length > 0) {
            onListingChange({ ...currentListing, itemSpecifics: autoFilled });
          }
        }
      } catch (err) {
        console.error("Failed to fetch specifics:", err);
      } finally {
        setLoadingSpecifics(false);
      }
    }

    fetchSpecifics();
  }, [listing?.categoryId]);

  function handleChange(field, value) {
    onListingChange({ ...listing, [field]: value });
  }

  function handleSpecificChange(name, value) {
    const updated = { ...listing.itemSpecifics, [name]: value };
    handleChange("itemSpecifics", updated);
  }

  if (!listing) return null;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Title
          <span className="ml-1 text-xs text-zinc-400">
            ({(listing.title || "").length}/80)
          </span>
        </label>
        <input
          type="text"
          maxLength={80}
          value={listing.title || ""}
          onChange={(e) => handleChange("title", e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Category
        </label>
        {loadingCategories ? (
          <p className="mt-1 text-sm text-zinc-400">Loading categories...</p>
        ) : (
          <select
            value={listing.categoryId || ""}
            onChange={(e) => {
              const cat = categories.find((c) => c.id === e.target.value);
              onListingChange({
                ...listing,
                categoryId: e.target.value,
                categoryName: cat?.name || "",
                itemSpecifics: {},
              });
            }}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.ancestors.length > 0
                  ? `${cat.ancestors.join(" > ")} > ${cat.name}`
                  : cat.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Condition */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Condition
        </label>
        <select
          value={listing.condition || ""}
          onChange={(e) => handleChange("condition", e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">Select condition</option>
          <option value="NEW_WITH_TAGS">New With Tags</option>
          <option value="NEW_WITHOUT_TAGS">New Without Tags</option>
          <option value="NEW_WITH_DEFECTS">New With Defects</option>
          <option value="PRE_OWNED">Pre-Owned</option>
        </select>
      </div>

      {/* Condition Description */}
      {listing.condition && listing.condition !== "NEW_WITH_TAGS" && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Condition Description
          </label>
          <textarea
            value={listing.condition_description || ""}
            onChange={(e) =>
              handleChange("condition_description", e.target.value)
            }
            rows={2}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </label>
        <textarea
          value={listing.item_description || ""}
          onChange={(e) => handleChange("item_description", e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* eBay Item Specifics (dynamic — only what eBay requires for this category) */}
      {loadingSpecifics && (
        <p className="text-sm text-zinc-400">Loading item specifics...</p>
      )}
      {specifics.length > 0 && !loadingSpecifics && (
        <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Item Specifics
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {specifics.map((spec) => (
              <div key={spec.name}>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {spec.localizedName}
                  {spec.required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </label>
                {spec.values.length > 0 ? (
                  <select
                    value={listing.itemSpecifics?.[spec.name] || ""}
                    onChange={(e) =>
                      handleSpecificChange(spec.name, e.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">Select</option>
                    {spec.values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={listing.itemSpecifics?.[spec.name] || ""}
                    onChange={(e) =>
                      handleSpecificChange(spec.name, e.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listing Type + Price */}
      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Pricing & Options
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {/* Listing Type */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Listing Type
            </label>
            <select
              value={listing.listingType || DEFAULTS.LISTING_TYPE}
              onChange={(e) => handleChange("listingType", e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="FIXED_PRICE">Fixed Price</option>
              <option value="AUCTION">Auction</option>
            </select>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Price ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={listing.price || ""}
              onChange={(e) => handleChange("price", e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              value={listing.quantity || DEFAULTS.QUANTITY}
              onChange={(e) => handleChange("quantity", parseInt(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          {/* SKU */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              SKU
            </label>
            <input
              type="text"
              value={listing.sku || ""}
              onChange={(e) => handleChange("sku", e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
      </div>

      {/* Best Offer */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={listing.bestOffer || false}
            onChange={(e) => handleChange("bestOffer", e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-700"
          />
          Best Offer
        </label>
        {listing.bestOffer && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-500">Min offer $</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={listing.minOffer || ""}
              onChange={(e) => handleChange("minOffer", e.target.value)}
              className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        )}
      </div>

      {/* Promoted Listing */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={
              listing.promotedListing !== undefined
                ? listing.promotedListing
                : true
            }
            onChange={(e) => handleChange("promotedListing", e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-700"
          />
          Promoted Listing
        </label>
        {(listing.promotedListing !== undefined
          ? listing.promotedListing
          : true) && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-500">Ad rate</label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="100"
              value={listing.promoRate || DEFAULTS.PROMO_RATE}
              onChange={(e) =>
                handleChange("promoRate", parseFloat(e.target.value))
              }
              className="w-20 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <span className="text-sm text-zinc-500">%</span>
          </div>
        )}
      </div>
    </div>
  );
}
