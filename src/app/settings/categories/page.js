"use client";

import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingSpecifics, setLoadingSpecifics] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");

  // Load saved config
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.success) {
          setCategories(data.categories || {});
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Search eBay categories
  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/ebay/categories?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.categories || []);
      }
    } catch (err) {
      console.error("Category search failed:", err);
    } finally {
      setSearching(false);
    }
  }

  // Add a category and load its specifics
  async function addCategory(cat) {
    if (categories[cat.id]) {
      setExpandedCategory(cat.id);
      setSearchResults([]);
      setSearchQuery("");
      return;
    }

    setLoadingSpecifics(cat.id);
    try {
      const res = await fetch(`/api/ebay/specifics?categoryId=${cat.id}`);
      const data = await res.json();
      if (data.success) {
        const specificsConfig = {};
        for (const spec of data.specifics) {
          specificsConfig[spec.name] = {
            localizedName: spec.localizedName,
            multiSelect: false,
            required: spec.required,
            hasValues: spec.values.length > 0,
          };
        }

        const updated = {
          ...categories,
          [cat.id]: {
            name: cat.name,
            path:
              cat.ancestors.length > 0
                ? `${cat.ancestors.join(" > ")} > ${cat.name}`
                : cat.name,
            specifics: specificsConfig,
          },
        };
        setCategories(updated);
        setExpandedCategory(cat.id);
        await saveConfig(updated);
      }
    } catch (err) {
      console.error("Failed to load specifics:", err);
    } finally {
      setLoadingSpecifics(null);
      setSearchResults([]);
      setSearchQuery("");
    }
  }

  // Toggle multi-select for a specific
  async function toggleMultiSelect(categoryId, specificName) {
    const updated = { ...categories };
    updated[categoryId] = { ...updated[categoryId] };
    updated[categoryId].specifics = { ...updated[categoryId].specifics };
    updated[categoryId].specifics[specificName] = {
      ...updated[categoryId].specifics[specificName],
      multiSelect: !updated[categoryId].specifics[specificName].multiSelect,
    };
    setCategories(updated);
    await saveConfig(updated);
  }

  // Remove a category
  async function removeCategory(categoryId) {
    const updated = { ...categories };
    delete updated[categoryId];
    setCategories(updated);
    if (expandedCategory === categoryId) setExpandedCategory(null);
    await saveConfig(updated);
  }

  // Save config to Cloudinary
  async function saveConfig(data) {
    setSaving(true);
    setSaveStatus("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: data }),
      });
      const result = await res.json();
      if (result.success) {
        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(""), 2000);
      } else {
        setSaveStatus("Save failed");
      }
    } catch {
      setSaveStatus("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm text-zinc-400">Loading settings...</p>
      </div>
    );
  }

  const categoryIds = Object.keys(categories);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Categories
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configure which item specifics allow multi-select per category.
          </p>
        </div>
        {saveStatus && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              saveStatus === "Saved"
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
            }`}
          >
            {saveStatus}
          </span>
        )}
      </div>

      {/* Add Category */}
      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Add Category
        </h2>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search eBay categories (e.g. mens jeans, womens dresses)"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
              searching || !searchQuery.trim()
                ? "cursor-not-allowed bg-blue-600 opacity-50"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-1">
            {searchResults.map((cat) => (
              <button
                key={cat.id}
                onClick={() => addCategory(cat)}
                disabled={loadingSpecifics === cat.id}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {cat.name}
                  </span>
                  {cat.ancestors.length > 0 && (
                    <span className="ml-2 text-xs text-zinc-400">
                      {cat.ancestors.join(" > ")}
                    </span>
                  )}
                </div>
                {loadingSpecifics === cat.id ? (
                  <span className="text-xs text-zinc-400">Loading...</span>
                ) : categories[cat.id] ? (
                  <span className="text-xs text-green-600">Added</span>
                ) : (
                  <span className="text-xs text-blue-600">+ Add</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Saved Categories */}
      <div className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Saved Categories ({categoryIds.length})
        </h2>

        {categoryIds.length === 0 && (
          <p className="text-sm text-zinc-400">
            No categories added yet. Search above to add one.
          </p>
        )}

        {categoryIds.map((catId) => {
          const cat = categories[catId];
          const isExpanded = expandedCategory === catId;
          const specificsEntries = Object.entries(cat.specifics || {});
          const multiCount = specificsEntries.filter(
            ([, s]) => s.multiSelect
          ).length;

          return (
            <div
              key={catId}
              className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Category Header */}
              <div
                onClick={() =>
                  setExpandedCategory(isExpanded ? null : catId)
                }
                className="flex cursor-pointer items-center justify-between px-5 py-3"
              >
                <div className="flex-1">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {cat.name}
                  </span>
                  <span className="ml-2 text-xs text-zinc-400">
                    {cat.path !== cat.name ? cat.path : ""}
                  </span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {specificsEntries.length} specifics
                    {multiCount > 0 && ` (${multiCount} multi-select)`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCategory(catId);
                    }}
                    className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    Remove
                  </button>
                  <svg
                    className={`h-4 w-4 text-zinc-400 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </div>
              </div>

              {/* Expanded Specifics */}
              {isExpanded && (
                <div className="border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
                  <div className="grid grid-cols-2 gap-1">
                    {specificsEntries.map(([name, spec]) => (
                      <label
                        key={name}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <input
                          type="checkbox"
                          checked={spec.multiSelect}
                          onChange={() => toggleMultiSelect(catId, name)}
                          className="rounded border-zinc-300 dark:border-zinc-700"
                        />
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {spec.localizedName}
                        </span>
                        {spec.required && (
                          <span className="text-xs text-red-500">*</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
