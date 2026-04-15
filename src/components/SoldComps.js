"use client";

import { useState, useEffect } from "react";

export default function SoldComps({ searchTerms, onPriceSelect }) {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!searchTerms) return;

    async function fetchComps() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/ebay/comps?q=${encodeURIComponent(searchTerms)}`
        );
        const data = await res.json();
        if (data.success) {
          setItems(data.items);
          setStats(data.stats);
        } else {
          setError(data.error || "Failed to fetch comps");
        }
      } catch (err) {
        setError("Could not connect to eBay");
      } finally {
        setLoading(false);
      }
    }

    fetchComps();
  }, [searchTerms]);

  if (!searchTerms) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Sold Comps
      </h3>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
          <svg
            className="h-4 w-4 animate-spin"
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
          Searching eBay for sold items...
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
          {error}
        </p>
      )}

      {stats && !loading && (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Average</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              ${stats.average}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Low</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              ${stats.low}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">High</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              ${stats.high}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Results</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {stats.count}
            </p>
          </div>
        </div>
      )}

      {items.length > 0 && !loading && (
        <div className="mt-4 space-y-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                  {item.title}
                </p>
                <p className="text-xs text-zinc-400">
                  {item.condition}
                </p>
              </div>
              <button
                onClick={() => onPriceSelect?.(item.price)}
                className="flex-shrink-0 rounded bg-zinc-100 px-2.5 py-1 text-sm font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                title="Use this price"
              >
                ${item.price}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && searchTerms && (
        <p className="mt-3 text-sm text-zinc-400">
          No sold comps found. Try different search terms.
        </p>
      )}
    </div>
  );
}
