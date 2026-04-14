"use client";

import { useState, useRef, useEffect } from "react";

export default function ItemSpecificPicker({
  label,
  required,
  options = [],
  value,
  onChange,
  multiSelect = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  // Normalize value to array for consistent handling
  const selected = Array.isArray(value)
    ? value
    : value
      ? [value]
      : [];

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  // Focus search when opened
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  // Filter options by search
  const searchLower = search.toLowerCase();
  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(searchLower))
    : options;

  // Check if search term is a custom value (not in options)
  const isCustom =
    search.trim() &&
    !options.some((o) => o.toLowerCase() === searchLower);

  function handleSelect(val) {
    if (multiSelect) {
      if (selected.includes(val)) {
        // Deselect
        const updated = selected.filter((v) => v !== val);
        onChange(updated.length === 0 ? "" : updated);
      } else {
        onChange([...selected, val]);
      }
    } else {
      // Single select — toggle off if same value
      if (selected.includes(val)) {
        onChange("");
      } else {
        onChange(val);
        setIsOpen(false);
        setSearch("");
      }
    }
  }

  function handleAddCustom() {
    const val = search.trim();
    if (!val) return;
    if (multiSelect) {
      if (!selected.includes(val)) {
        onChange([...selected, val]);
      }
    } else {
      onChange(val);
      setIsOpen(false);
    }
    setSearch("");
  }

  function handleClear() {
    onChange(multiSelect ? [] : "");
  }

  // Display text for the trigger button
  const displayText =
    selected.length === 0
      ? "Select"
      : selected.join(", ");

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
        {multiSelect && (
          <span className="ml-1 text-xs text-zinc-400">(multi)</span>
        )}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`mt-1 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
          isOpen
            ? "border-blue-500 ring-1 ring-blue-500"
            : "border-zinc-300 dark:border-zinc-700"
        } ${
          selected.length > 0
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-400"
        } bg-white dark:bg-zinc-800`}
      >
        <span className="truncate">{displayText}</span>
        <svg
          className={`ml-2 h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform ${
            isOpen ? "rotate-180" : ""
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
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {/* Search Input */}
          <div className="border-b border-zinc-200 p-2 dark:border-zinc-700">
            <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900">
              <svg
                className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isCustom) {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
                placeholder="Search or enter your own"
                className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {/* Selected Section */}
            {selected.length > 0 && (
              <>
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Selected
                  </span>
                  <button
                    onClick={handleClear}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Clear
                  </button>
                </div>
                {selected.map((val) => (
                  <button
                    key={`selected-${val}`}
                    onClick={() => handleSelect(val)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <span>{val}</span>
                    <svg
                      className="h-4 w-4 text-blue-600 dark:text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  </button>
                ))}
                <div className="mx-3 border-b border-zinc-200 dark:border-zinc-700" />
              </>
            )}

            {/* Custom Entry Option */}
            {isCustom && (
              <button
                onClick={handleAddCustom}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Add &ldquo;{search.trim()}&rdquo;
              </button>
            )}

            {/* Options List */}
            {filtered.map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <span>{opt}</span>
                  {isSelected && (
                    <svg
                      className="h-4 w-4 text-blue-600 dark:text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  )}
                </button>
              );
            })}

            {/* No results */}
            {filtered.length === 0 && !isCustom && (
              <p className="px-3 py-3 text-center text-sm text-zinc-400">
                No options found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
