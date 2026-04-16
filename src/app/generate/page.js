"use client";

import { useState, useEffect } from "react";
import PhotoLibrarySidebar from "@/components/PhotoLibrarySidebar";
import PhotoZone from "@/components/PhotoZone";
import ListingForm from "@/components/ListingForm";
import SoldComps from "@/components/SoldComps";
import { usePhotoTransfer } from "@/contexts/PhotoTransferContext";

export default function Generate() {
  const { hasPending, consumeTransfer } = usePhotoTransfer();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiPhotos, setAiPhotos] = useState([]);
  const [listingPhotos, setListingPhotos] = useState([]);
  const [listing, setListing] = useState({
    title: "",
    categoryId: "",
    categoryName: "",
    condition: "",
    condition_description: "",
    item_description: "",
    quantity: 1,
    bestOffer: true,
    autoAcceptPrice: "",
    promotedListing: true,
    promoRate: 5,
    priorityListing: false,
    priorityBudget: 3,
    weightLbs: "",
    weightOz: "",
    dimLength: "",
    dimWidth: "",
    dimHeight: "",
    shippingPolicyId: "",
    paymentPolicyId: "",
    returnPolicyId: "",
    itemSpecifics: {},
    sku: "",
    scheduleEnabled: true,
    scheduledDate: "",
    scheduledTime: "17:00",
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [lookupStatus, setVisionStatus] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const canAnalyze = aiPhotos.length > 0 && !analyzing;

  // Consume photos transferred from Library page
  useEffect(() => {
    if (hasPending) {
      const { listing, ai } = consumeTransfer();
      if (listing.length > 0) {
        setListingPhotos((prev) => [...prev, ...listing]);
      }
      if (ai.length > 0) {
        setAiPhotos((prev) => [...prev, ...ai]);
      }
    }
  }, [hasPending, consumeTransfer]);

  // Parse "32x30" or "32 x 30" format into [waist, inseam] numbers
  function parsePantSize(sizeStr) {
    if (!sizeStr) return null;
    const match = sizeStr.match(/(\d+)\s*x\s*(\d+)/i);
    if (!match) return null;
    return [parseInt(match[1], 10), parseInt(match[2], 10)];
  }

  // Check if the 2-inch rule applies for pants
  function checkTwoInchRule(observations) {
    const itemType = (observations?.type || "").toLowerCase();
    const isPants = ["pants", "jeans", "shorts", "trousers", "chinos"].some(
      (t) => itemType.includes(t)
    );
    if (!isPants) return false;

    const tag = parsePantSize(observations?.tag_size);
    const measured = parsePantSize(observations?.measured_size);
    if (!tag || !measured) return false;

    const waistDiff = Math.abs(tag[0] - measured[0]);
    const inseamDiff = Math.abs(tag[1] - measured[1]);
    return waistDiff >= 2 || inseamDiff >= 2;
  }

  function getConditionBoilerplate(condition) {
    const boilerplate =
      "Please see all photos for condition as all flaws will be shown throughout the photos! Please review the measurements provided in the photos. It is best to compare our listing's measurements to a similar article of clothing in your closet to ensure a proper fit!";

    if (condition === "NEW_WITH_TAGS") return `New With Tags! ${boilerplate}`;
    if (condition === "NEW_WITHOUT_TAGS") return `New Without Tags! ${boilerplate}`;
    if (condition === "NEW_WITH_DEFECTS") return `New With Defects! ${boilerplate}`;
    return `Pre-owned condition! ${boilerplate}`;
  }

  function buildDescription(title, condition, observations) {
    const lines = [];

    // Line 1: Title
    lines.push(title);
    lines.push("");

    // Pants 2-inch rule: show tag vs measured only when difference is 2+ inches
    if (checkTwoInchRule(observations)) {
      lines.push(`Tag - ${observations.tag_size}`);
      lines.push(`Measures ${observations.measured_size}`);
      lines.push("");
    }

    // Condition boilerplate
    lines.push(getConditionBoilerplate(condition));
    lines.push("");
    lines.push("Ships USPS Ground Advantage!");

    return lines.join("<br>");
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError("");
    setVisionStatus("");
    setAnalysisStep("Analyzing photos...");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: aiPhotos }),
      });
      const data = await res.json();
      if (data.success) {
        const aiListing = { ...data.listing };

        // Style number lookup: if Pass 1 found a style number, search for the model name
        const styleNumber = aiListing.observations?.style_number;
        if (styleNumber) {
          try {
            setAnalysisStep(`Looking up style number ${styleNumber}...`);
            const refineRes = await fetch("/api/generate/refine", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ listing: aiListing }),
            });
            const refineData = await refineRes.json();
            if (refineData.success && refineData.listing) {
              Object.assign(aiListing, refineData.listing);
              const modelName = refineData.listing.observations?.model;
              setVisionStatus(
                modelName
                  ? `Style Lookup: Found "${modelName}" from style #${styleNumber}`
                  : `Style Lookup: Searched style #${styleNumber} but no model found`
              );
            } else {
              setVisionStatus(`Style Lookup: Searched style #${styleNumber} but no model found`);
            }
          } catch (err) {
            setVisionStatus(`Style Lookup: Search failed for #${styleNumber}`);
            console.error("Style lookup failed:", err);
          }
        }

        if (aiListing.title && aiListing.title.length > 80) {
          aiListing.title = aiListing.title.substring(0, 80);
        }

        // Pants 2-inch rule: add asterisk to measured size in title
        if (checkTwoInchRule(aiListing.observations)) {
          const measured = aiListing.observations.measured_size;
          const measuredParsed = parsePantSize(measured);
          if (measuredParsed) {
            const sizeStr = `${measuredParsed[0]}x${measuredParsed[1]}`;
            // Add asterisk after the measured size in the title
            if (aiListing.title.includes(sizeStr)) {
              aiListing.title = aiListing.title.replace(sizeStr, sizeStr + "*");
              // Re-truncate if asterisk pushed past 80
              if (aiListing.title.length > 80) {
                aiListing.title = aiListing.title.substring(0, 80);
              }
            }
          }
        }

        // Build description from template
        aiListing.item_description = buildDescription(
          aiListing.title,
          aiListing.condition,
          aiListing.observations
        );

        // Set condition description to static boilerplate (not AI-generated)
        aiListing.condition_description = getConditionBoilerplate(aiListing.condition);

        setListing((prev) => ({
          ...prev,
          ...aiListing,
          itemSpecifics: {},
        }));
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch (err) {
      setError("Could not connect to AI service");
    } finally {
      setAnalyzing(false);
      setAnalysisStep("");
    }
  }

  function handlePriceSelect(price) {
    if (listing) {
      setListing({ ...listing, price });
    }
  }

  async function handleSubmitListing() {
    setSubmitting(true);
    setSubmitStatus(null);

    try {
      const res = await fetch("/api/ebay/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...listing,
          photos: listingPhotos,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const pr = data.promoResult || "";
        const promoMsg = pr === "promoted" ? " | Promoted"
          : pr === "promoted_updated" ? " | Promoted (rate updated)"
          : pr === "promoted_existing" ? " | Already promoted"
          : pr === "no_campaign" ? " | No campaign found"
          : pr.startsWith("promo_failed") ? ` | ${pr}`
          : "";
        setSubmitStatus({
          type: "success",
          message: `Listed on eBay!${promoMsg} ${data.url}`,
          listingId: data.listingId,
          url: data.url,
        });
      } else {
        setSubmitStatus({
          type: "error",
          message: `Failed: ${data.error}`,
          step: data.step,
        });
      }
    } catch (err) {
      setSubmitStatus({
        type: "error",
        message: `Connection error: ${err.message}`,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] md:h-[calc(100vh-3.5rem)]">
      {/* Photo Library Sidebar — hidden on mobile */}
      <div className="hidden md:flex">
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
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Create Listing
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="hidden md:inline">
              Drag photos from the library into the zones below, then let AI
              generate listing details.
            </span>
            <span className="md:hidden">
              Add photos from the Library tab, then let AI generate listing
              details.
            </span>
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
              subtitle="Up to 8 photos for AI to analyze (compressed to 600px)"
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
                  {analysisStep || "Analyzing..."}
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

            {lookupStatus && !analyzing && (
              <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
                lookupStatus.includes("Found model")
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                  : lookupStatus.includes("error") || lookupStatus.includes("failed")
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                    : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
              }`}>
                {lookupStatus.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}
          </div>

          {/* Listing Form + Sold Comps */}
          <div className="mt-8 space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Listing Details
              </h2>
              <div className="mt-4">
                <ListingForm
                  listing={listing}
                  onListingChange={setListing}
                  onSubmit={handleSubmitListing}
                  submitting={submitting}
                  submitStatus={submitStatus}
                />
              </div>
            </div>

            {listing.suggested_search_terms && (
              <SoldComps
                searchTerms={listing.suggested_search_terms}
                onPriceSelect={handlePriceSelect}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
