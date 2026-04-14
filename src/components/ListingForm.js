"use client";

import { useState, useEffect } from "react";
import { DEFAULTS } from "@/lib/constants";
import ItemSpecificPicker from "@/components/ItemSpecificPicker";

export default function ListingForm({ listing, onListingChange, onSubmit, submitting, submitStatus }) {
  const [categories, setCategories] = useState([]);
  const [specifics, setSpecifics] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSpecifics, setLoadingSpecifics] = useState(false);
  const [fillingSpecifics, setFillingSpecifics] = useState(false);
  const [settingsConfig, setSettingsConfig] = useState({});
  const [initialSettingsConfig, setInitialSettingsConfig] = useState({});
  const [policies, setPolicies] = useState({});

  // Load settings config + policies
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.success) {
          setSettingsConfig(data.categories || {});
          setInitialSettingsConfig(data.categories || {});
          setPolicies(data.policies || {});
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }
    loadSettings();
  }, []);

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

  // Fetch item specifics when category changes, then trigger Pass 2
  useEffect(() => {
    if (!listing?.categoryId) return;

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

          // Auto-add category to settings if not already there
          if (!settingsConfig[currentListing.categoryId]) {
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
            const updated = {
              ...settingsConfig,
              [currentListing.categoryId]: {
                name: catName,
                path: catName,
                specifics: specificsConfig,
              },
            };
            setSettingsConfig(updated);

            fetch("/api/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ categories: updated }),
            }).catch(() => {});
          }

          // Pass 2: AI fills specifics using observations
          if (currentListing.observations) {
            setFillingSpecifics(true);
            try {
              const pass2Res = await fetch("/api/generate/specifics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  observations: currentListing.observations,
                  specifics: data.specifics,
                  title: currentListing.title,
                }),
              });
              const pass2Data = await pass2Res.json();
              if (pass2Data.success && pass2Data.specifics) {
                // Split comma-separated strings into arrays for multi-select fields
                const catConfig = settingsConfig[currentListing.categoryId];
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
                onListingChange({
                  ...currentListing,
                  itemSpecifics: cleaned,
                });
              }
            } catch (err) {
              console.error("Pass 2 specifics fill failed:", err);
            } finally {
              setFillingSpecifics(false);
            }
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

  // Auto-fill default policies when settings load or listing is created
  const defaultShipping = policies.defaultShipping || "";
  const defaultPayment = policies.defaultPayment || "";
  const defaultReturn = policies.defaultReturn || "";
  const listingTitle = listing?.title || "";
  useEffect(() => {
    if (!listing) return;
    if (!defaultShipping && !defaultPayment && !defaultReturn) return;
    const updates = {};
    if (!listing.shippingPolicyId && defaultShipping) {
      updates.shippingPolicyId = defaultShipping;
    }
    if (!listing.paymentPolicyId && defaultPayment) {
      updates.paymentPolicyId = defaultPayment;
    }
    if (!listing.returnPolicyId && defaultReturn) {
      updates.returnPolicyId = defaultReturn;
    }
    if (Object.keys(updates).length > 0) {
      onListingChange({ ...listing, ...updates });
    }
  }, [defaultShipping, defaultPayment, defaultReturn, listingTitle]);

  function handleChange(field, value) {
    onListingChange({ ...listing, [field]: value });
  }

  function handleSpecificChange(name, value) {
    const updated = { ...listing.itemSpecifics, [name]: value };
    handleChange("itemSpecifics", updated);
  }

  const isNewCategory =
    listing.categoryId && !initialSettingsConfig[listing.categoryId];

  const requiredSpecifics = specifics.filter((s) => s.required);
  const additionalSpecifics = specifics.filter((s) => !s.required);

  // Get country of manufacture from item specifics for item origin
  const countryOfManufacture =
    listing.itemSpecifics?.["Country/Region of Manufacture"] || "";

  const shippingPolicies = Array.isArray(policies.shipping)
    ? policies.shipping
    : [];
  const paymentPolicies = Array.isArray(policies.payment)
    ? policies.payment
    : [];
  const returnPolicies = Array.isArray(policies.return)
    ? policies.return
    : [];

  return (
    <div className="space-y-6">
      {/* 1. Title */}
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

      {/* 2. Category */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Category
          {isNewCategory && (
            <span className="ml-2 text-xs font-semibold text-red-500">
              NEW — configure in Settings
            </span>
          )}
        </label>
        {loadingCategories ? (
          <p className="mt-1 text-sm text-zinc-400">Loading categories...</p>
        ) : (
          <>
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
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 ${
                isNewCategory
                  ? "border-red-500 bg-red-50 ring-1 ring-red-500 dark:border-red-500 dark:bg-red-950/20"
                  : "border-zinc-300 bg-white dark:border-zinc-700"
              }`}
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
            {listing.categoryId && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {categories.find((c) => c.id === listing.categoryId)
                  ? (() => {
                      const cat = categories.find((c) => c.id === listing.categoryId);
                      return cat.ancestors.length > 0
                        ? `${cat.ancestors.join(" > ")} > ${cat.name}`
                        : cat.name;
                    })()
                  : listing.categoryName}
              </p>
            )}
          </>
        )}
      </div>

      {/* 2b. SKU */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          SKU <span className="text-xs text-zinc-400">(optional)</span>
        </label>
        <input
          type="text"
          value={listing.sku || ""}
          onChange={(e) => handleChange("sku", e.target.value)}
          placeholder="e.g. SH-2024-0001"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* 3. Item Specifics */}
      {(loadingSpecifics || fillingSpecifics) && (
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 animate-spin text-blue-500"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-zinc-400">
            {fillingSpecifics
              ? "AI is filling item specifics..."
              : "Loading item specifics..."}
          </p>
        </div>
      )}
      {specifics.length > 0 && !loadingSpecifics && (
        <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Item Specifics
          </h3>

          {/* Required */}
          {requiredSpecifics.length > 0 && (
            <>
              <p className="mt-3 text-xs font-medium text-zinc-400">
                Required
              </p>
              <div className="mt-2 grid grid-cols-2 gap-4">
                {requiredSpecifics.map((spec) => {
                  const catConfig = settingsConfig[listing.categoryId];
                  const specConfig = catConfig?.specifics?.[spec.name];
                  const isMulti = specConfig?.multiSelect || false;
                  return (
                    <ItemSpecificPicker
                      key={spec.name}
                      label={spec.localizedName}
                      required={spec.required}
                      options={spec.values}
                      value={listing.itemSpecifics?.[spec.name] || ""}
                      onChange={(val) => handleSpecificChange(spec.name, val)}
                      multiSelect={isMulti}
                    />
                  );
                })}
              </div>
            </>
          )}

          {/* Additional */}
          {additionalSpecifics.length > 0 && (
            <>
              <p className="mt-5 text-xs font-medium text-zinc-400">
                Additional
              </p>
              <div className="mt-2 grid grid-cols-2 gap-4">
                {additionalSpecifics.map((spec) => {
                  const catConfig = settingsConfig[listing.categoryId];
                  const specConfig = catConfig?.specifics?.[spec.name];
                  const isMulti = specConfig?.multiSelect || false;
                  return (
                    <ItemSpecificPicker
                      key={spec.name}
                      label={spec.localizedName}
                      required={spec.required}
                      options={spec.values}
                      value={listing.itemSpecifics?.[spec.name] || ""}
                      onChange={(val) => handleSpecificChange(spec.name, val)}
                      multiSelect={isMulti}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. Condition */}
      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Condition
        </h3>
        <div className="mt-3">
          <select
            value={listing.condition || ""}
            onChange={(e) => handleChange("condition", e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Select condition</option>
            <option value="NEW_WITH_TAGS">New With Tags</option>
            <option value="NEW_WITHOUT_TAGS">New Without Tags</option>
            <option value="NEW_WITH_DEFECTS">New With Defects</option>
            <option value="PRE_OWNED_EXCELLENT">Pre-Owned - Excellent</option>
            <option value="PRE_OWNED_GOOD">Pre-Owned - Good</option>
            <option value="PRE_OWNED_FAIR">Pre-Owned - Fair</option>
          </select>
        </div>

        {/* Condition Description — only for PRE_OWNED variants */}
        {listing.condition?.startsWith("PRE_OWNED") && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Condition Description
            </label>
            <textarea
              value={listing.condition_description || ""}
              onChange={(e) =>
                handleChange("condition_description", e.target.value)
              }
              rows={2}
              ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
              onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              className="mt-1 w-full resize-none overflow-hidden rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        )}
      </div>

      {/* 5. Description */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </label>
        <textarea
          value={listing.item_description || ""}
          onChange={(e) => handleChange("item_description", e.target.value)}
          rows={3}
          ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
          onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
          className="mt-1 w-full resize-none overflow-hidden rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* 6. Pricing */}
      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Pricing
        </h3>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Format
            </label>
            <select
              value={listing.listingType || DEFAULTS.LISTING_TYPE}
              onChange={(e) => handleChange("listingType", e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="FIXED_PRICE">Buy It Now</option>
              <option value="AUCTION">Auction</option>
            </select>
          </div>

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

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              value={listing.quantity || DEFAULTS.QUANTITY}
              onChange={(e) =>
                handleChange("quantity", parseInt(e.target.value))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
      </div>

      {/* 7. Allow Offers */}
      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Allow Offers
          </h3>
          <button
            type="button"
            onClick={() => handleChange("bestOffer", !listing.bestOffer)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              listing.bestOffer
                ? "bg-blue-600"
                : "bg-zinc-300 dark:bg-zinc-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                listing.bestOffer ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {listing.bestOffer && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Minimum Offer ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={listing.minOffer || ""}
                onChange={(e) => handleChange("minOffer", e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Auto Accept ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={listing.autoAcceptPrice || ""}
                onChange={(e) =>
                  handleChange("autoAcceptPrice", e.target.value)
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
        )}
      </div>

      {/* 7b. Schedule Listing */}
      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Schedule Listing
          </h3>
          <button
            type="button"
            onClick={() => handleChange("scheduleEnabled", !listing.scheduleEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              listing.scheduleEnabled
                ? "bg-blue-600"
                : "bg-zinc-300 dark:bg-zinc-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                listing.scheduleEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {listing.scheduleEnabled && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Date
              </label>
              <input
                type="date"
                value={listing.scheduledDate || ""}
                onChange={(e) => handleChange("scheduledDate", e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Time
              </label>
              <input
                type="time"
                value={listing.scheduledTime || "17:00"}
                onChange={(e) => handleChange("scheduledTime", e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
        )}
      </div>

      {/* 8. Shipping */}
      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Shipping
        </h3>
        <div className="mt-4 space-y-4">
          {/* Shipping Policy */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Shipping Policy
            </label>
            {shippingPolicies.length > 0 ? (
              <select
                value={listing.shippingPolicyId || ""}
                onChange={(e) =>
                  handleChange("shippingPolicyId", e.target.value)
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">Select shipping policy</option>
                {shippingPolicies.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.label || sp.id}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-sm text-zinc-400">
                No shipping policies configured.{" "}
                <a
                  href="/settings/policies"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Add in Settings
                </a>
              </p>
            )}
          </div>

          {/* Package Weight */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Package Weight{" "}
              <span className="text-xs text-zinc-400">(optional)</span>
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={listing.weightLbs || ""}
                onChange={(e) => handleChange("weightLbs", e.target.value)}
                placeholder="lbs"
                className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <span className="text-sm text-zinc-500">lbs</span>
              <input
                type="number"
                min="0"
                max="15"
                value={listing.weightOz || ""}
                onChange={(e) => handleChange("weightOz", e.target.value)}
                placeholder="oz"
                className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <span className="text-sm text-zinc-500">oz</span>
            </div>
          </div>

          {/* Package Dimensions */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Package Dimensions{" "}
              <span className="text-xs text-zinc-400">(optional)</span>
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={listing.dimLength || ""}
                onChange={(e) => handleChange("dimLength", e.target.value)}
                placeholder="L"
                className="w-20 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <span className="text-sm text-zinc-500">x</span>
              <input
                type="number"
                min="0"
                value={listing.dimWidth || ""}
                onChange={(e) => handleChange("dimWidth", e.target.value)}
                placeholder="W"
                className="w-20 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <span className="text-sm text-zinc-500">x</span>
              <input
                type="number"
                min="0"
                value={listing.dimHeight || ""}
                onChange={(e) => handleChange("dimHeight", e.target.value)}
                placeholder="H"
                className="w-20 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <span className="text-sm text-zinc-500">in.</span>
            </div>
          </div>

          {/* Item Origin */}
          {countryOfManufacture && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Item Origin
              </label>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {countryOfManufacture}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 9. Preferences */}
      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Preferences
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {/* Payment Policy */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Payment Policy
            </label>
            {paymentPolicies.length > 0 ? (
              <select
                value={listing.paymentPolicyId || ""}
                onChange={(e) =>
                  handleChange("paymentPolicyId", e.target.value)
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">Select payment policy</option>
                {paymentPolicies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label || p.id}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-sm text-zinc-400">
                <a
                  href="/settings/policies"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Add in Settings
                </a>
              </p>
            )}
          </div>

          {/* Return Policy */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Return Policy
            </label>
            {returnPolicies.length > 0 ? (
              <select
                value={listing.returnPolicyId || ""}
                onChange={(e) =>
                  handleChange("returnPolicyId", e.target.value)
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">Select return policy</option>
                {returnPolicies.map((rp) => (
                  <option key={rp.id} value={rp.id}>
                    {rp.label || rp.id}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-sm text-zinc-400">
                <a
                  href="/settings/policies"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Add in Settings
                </a>
              </p>
            )}
          </div>
        </div>

      </div>

      {/* 10. Promote Listing */}
      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Promote Listing
        </h3>

        {/* General Promotion */}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              General
            </p>
            <p className="text-xs text-zinc-400">
              Pay a percentage when the item sells
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              handleChange(
                "promotedListing",
                listing.promotedListing !== undefined
                  ? !listing.promotedListing
                  : false
              )
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              (listing.promotedListing !== undefined
                ? listing.promotedListing
                : true)
                ? "bg-blue-600"
                : "bg-zinc-300 dark:bg-zinc-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                (listing.promotedListing !== undefined
                  ? listing.promotedListing
                  : true)
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {(listing.promotedListing !== undefined
          ? listing.promotedListing
          : true) && (
          <div className="mt-2 flex items-center gap-2">
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

        {/* Priority Promotion */}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Priority
            </p>
            <p className="text-xs text-zinc-400">
              Pay per click, daily budget
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              handleChange("priorityListing", !listing.priorityListing)
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              listing.priorityListing
                ? "bg-blue-600"
                : "bg-zinc-300 dark:bg-zinc-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                listing.priorityListing ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {listing.priorityListing && (
          <div className="mt-2 flex items-center gap-2">
            <label className="text-sm text-zinc-500">Daily budget</label>
            <span className="text-sm text-zinc-500">$</span>
            <input
              type="number"
              step="1"
              min="3"
              value={listing.priorityBudget || DEFAULTS.PRIORITY_BUDGET}
              onChange={(e) =>
                handleChange("priorityBudget", parseFloat(e.target.value))
              }
              className="w-20 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <span className="text-sm text-zinc-500">/day</span>
          </div>
        )}
      </div>

      {/* 11. Submit */}
      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        {submitStatus && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              submitStatus.type === "success"
                ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
            }`}
          >
            {submitStatus.message}
          </div>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !listing.title || !listing.categoryId || !listing.price}
          className={`w-full rounded-lg py-3 text-sm font-semibold text-white transition-colors ${
            submitting || !listing.title || !listing.categoryId || !listing.price
              ? "cursor-not-allowed bg-zinc-400"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {submitting
            ? "Listing on eBay..."
            : listing.scheduleEnabled && listing.scheduledDate
              ? `Schedule Listing for ${listing.scheduledDate}`
              : "List on eBay"}
        </button>
        {(!listing.title || !listing.categoryId || !listing.price) && (
          <p className="mt-2 text-center text-xs text-zinc-400">
            Title, category, and price are required to list
          </p>
        )}
      </div>
    </div>
  );
}
