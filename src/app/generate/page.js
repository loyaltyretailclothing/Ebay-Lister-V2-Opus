"use client";

import { useState } from "react";
import PhotoLibrarySidebar from "@/components/PhotoLibrarySidebar";
import PhotoZone from "@/components/PhotoZone";
import ListingForm from "@/components/ListingForm";
import SoldComps from "@/components/SoldComps";

export default function Generate() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiPhotos, setAiPhotos] = useState([]);
  const [listingPhotos, setListingPhotos] = useState([]);
  const [listing, setListing] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const canAnalyze = aiPhotos.length > 0 && !analyzing;

  async function handleAnalyze() {
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: aiPhotos }),
      });
      const data = await res.json();
      if (data.success) {
        setListing({
          ...data.listing,
          quantity: 1,
          bestOffer: false,
          promotedListing: true,
          promoRate: 5,
          itemSpecifics: {},
        });
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch (err) {
      setError("Could not connect to AI service");
    } finally {
      setAnalyzing(false);
    }
  }

  function handlePriceSelect(price) {
    if (listing) {
      setListing({ ...listing, price });
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Photo Library Sidebar */}
      <PhotoLibrarySidebar
        collapsed={!sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Sidebar expand button (when collapsed) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-full w-8 flex-shrink-0 items-start justify-center border-r border-zinc-200 bg-white pt-3 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
          title="Open photo library"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Create Listing
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Drag photos from the library into the zones below, then let AI
            generate listing details.
          </p>

          {/* Photo Zones — stacked vertically */}
          <div className="mt-6 space-y-6">
            <PhotoZone
              title="eBay Listing Photos"
              subtitle="Full quality photos for the listing (first = main image)"
              photos={listingPhotos}
              onPhotosChange={setListingPhotos}
            />

            <PhotoZone
              title="AI Analysis Photos"
              subtitle="Up to 8 photos for AI to analyze (compressed to 800px)"
              photos={aiPhotos}
              onPhotosChange={setAiPhotos}
              maxPhotos={8}
            />
          </div>

          {/* Analyze Button */}
          <div className="mt-6">
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className={`rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors ${
                canAnalyze
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "cursor-not-allowed bg-blue-600 opacity-50"
              }`}
            >
              {analyzing ? (
                <span className="flex items-center gap-2">
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
                  Analyzing...
                </span>
              ) : (
                "Analyze Photos"
              )}
            </button>

            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          {/* Listing Form + Sold Comps */}
          {listing && (
            <div className="mt-8 space-y-6">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Listing Details
                </h2>
                <div className="mt-4">
                  <ListingForm
                    listing={listing}
                    onListingChange={setListing}
                  />
                </div>
              </div>

              <SoldComps
                searchTerms={listing.suggested_search_terms}
                onPriceSelect={handlePriceSelect}
              />
            </div>
          )}

          {/* Placeholder when no listing */}
          {!listing && !analyzing && (
            <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Listing Details
              </h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Add photos above and click &ldquo;Analyze&rdquo; to generate
                listing details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
