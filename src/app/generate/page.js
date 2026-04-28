"use client";

import { useState, useEffect, useRef } from "react";
import PhotoLibrarySidebar from "@/components/PhotoLibrarySidebar";
import PhotoZone from "@/components/PhotoZone";
import ListingForm from "@/components/ListingForm";
import SoldComps from "@/components/SoldComps";
import SuccessModal from "@/components/SuccessModal";
import { usePhotoTransfer } from "@/contexts/PhotoTransferContext";
import { applyDescriptionTemplate } from "@/lib/descriptionTemplate";

const INITIAL_LISTING = {
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
};

export default function Generate() {
  const { hasPending, consumeTransfer } = usePhotoTransfer();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiPhotos, setAiPhotos] = useState([]);
  const [listingPhotos, setListingPhotos] = useState([]);
  const [listing, setListing] = useState(INITIAL_LISTING);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [lookupStatus, setLookupStatus] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [saveDraftStatus, setSaveDraftStatus] = useState(null);
  // Research mode: 'google' = waiting for the user to pick a photo to send to
  // Google Lens. null = idle. eBay Search runs immediately and never enters
  // a mode, so it's not represented here.
  const [researchMode, setResearchMode] = useState(null);
  const googleButtonRef = useRef(null);
  const ebayZoneWrapperRef = useRef(null);

  // Load a draft from ?draft=xxx in the URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("draft");
    if (!id) return;

    let cancelled = false;
    (async () => {
      setLoadingDraft(true);
      setError("");
      try {
        const res = await fetch(`/api/drafts/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.draft) {
          setDraftId(id);
          setListing({ ...INITIAL_LISTING, ...(data.draft.listing || {}) });
          setAiPhotos(data.draft.aiPhotos || []);
          setListingPhotos(data.draft.listingPhotos || []);
        } else {
          setError(data.error || "Failed to load draft");
        }
      } catch (err) {
        if (!cancelled) setError("Could not load draft: " + err.message);
      } finally {
        if (!cancelled) setLoadingDraft(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Cancel Google pick mode when clicking outside the eBay listing photos
  // zone or the Google button itself. Mousedown rather than click so the
  // ring/highlight clears before the click handler on whatever was clicked
  // runs.
  useEffect(() => {
    if (researchMode !== "google") return;
    function handleOutside(e) {
      if (ebayZoneWrapperRef.current?.contains(e.target)) return;
      if (googleButtonRef.current?.contains(e.target)) return;
      setResearchMode(null);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [researchMode]);

  // If the listing photos zone empties out while Google mode is active,
  // there's nothing to pick — auto-cancel.
  useEffect(() => {
    if (researchMode === "google" && listingPhotos.length === 0) {
      setResearchMode(null);
    }
  }, [researchMode, listingPhotos.length]);

  function handleToggleGoogleMode() {
    if (listingPhotos.length === 0) return;
    setResearchMode((prev) => (prev === "google" ? null : "google"));
  }

  function handlePickPhotoForGoogle(photo) {
    if (!photo?.secure_url) return;
    const url = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(photo.secure_url)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setResearchMode(null);
  }

  function handleEbaySearch() {
    // Extract Brand + Style Name + Item Type from the TITLE verbatim —
    // preserves the title's exact casing and characters (e.g. "Peter Millar"
    // not the raw "PETER MILLAR" from observations, "Button Down" not
    // "button-down"). Title format:
    //   [NWT] Brand [Style Name] Item Type Gender Size Color [Tier 2]
    // So we strip the optional NWT prefix and cut at the gender word. We
    // match the LAST gender occurrence so brands that contain a gender
    // token (e.g. "Mens Wearhouse") still extract correctly.
    const title = listing.title?.trim();
    if (!title) return;

    let query = title.replace(/^NWT\s+/i, "");
    const genderRegex = /\b(Mens|Womens|Boys|Girls|Unisex)\b/gi;
    let lastMatch = null;
    let m;
    while ((m = genderRegex.exec(query)) !== null) {
      lastMatch = m;
    }
    if (lastMatch) {
      query = query.substring(0, lastMatch.index).trim();
    }

    if (!query) return;
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError("");
    setLookupStatus("");
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
              const styleName = refineData.listing.observations?.style_name;
              setLookupStatus(
                styleName
                  ? `Style Lookup: Found "${styleName}" from style #${styleNumber}`
                  : `Style Lookup: Searched style #${styleNumber} but no style name found`
              );
            } else {
              setLookupStatus(`Style Lookup: Searched style #${styleNumber} but no model found`);
            }
          } catch (err) {
            setLookupStatus(`Style Lookup: Search failed for #${styleNumber}`);
            console.error("Style lookup failed:", err);
          }
        }

        // Apply all description-template rules (80-char truncate, 2-inch
        // asterisk, build item_description, overwrite condition_description
        // with boilerplate). Shared with /api/drafts/process so both flows
        // produce identical drafts.
        const finalListing = applyDescriptionTemplate(aiListing);

        setListing((prev) => ({
          ...prev,
          ...finalListing,
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

  async function handleSaveDraft() {
    if (savingDraft) return;
    setSavingDraft(true);
    setSaveDraftStatus(null);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draftId || undefined,
          listing,
          aiPhotos,
          listingPhotos,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDraftId(data.id);
        setSaveDraftStatus({ type: "success", message: "Draft saved" });
        // Reflect the draft id in the URL without a full reload, so a refresh
        // still points at this draft.
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("draft", data.id);
          window.history.replaceState({}, "", url);
        }
        setTimeout(() => setSaveDraftStatus(null), 2000);
      } else {
        setSaveDraftStatus({
          type: "error",
          message: data.error || "Save failed",
        });
      }
    } catch (err) {
      setSaveDraftStatus({
        type: "error",
        message: `Save failed: ${err.message}`,
      });
    } finally {
      setSavingDraft(false);
    }
  }

  async function maybeDeleteDraft() {
    if (!draftId) return;
    try {
      await fetch(`/api/drafts/${encodeURIComponent(draftId)}`, {
        method: "DELETE",
      });
    } catch {
      // Non-fatal — listing already published
    }
    setDraftId(null);
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
          promoResult: data.promoResult,
        });
        setShowSuccessModal(true);
        // Draft has been published — remove it so it doesn't linger
        maybeDeleteDraft();
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

  function handleNewListing() {
    setShowSuccessModal(false);
    setListing(INITIAL_LISTING);
    setAiPhotos([]);
    setListingPhotos([]);
    setSubmitStatus(null);
    setError("");
    setLookupStatus("");
    setAnalysisStep("");
    setDraftId(null);
    setSaveDraftStatus(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("draft");
      window.history.replaceState({}, "", url);
      window.scrollTo({ top: 0, behavior: "smooth" });
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

          {/* Research buttons — Google reverse image search + eBay search.
              Always visible; disabled state stays in place rather than
              hiding so the layout doesn't shift. */}
          <div className="mt-3 flex items-center gap-2">
            <button
              ref={googleButtonRef}
              onClick={handleToggleGoogleMode}
              disabled={listingPhotos.length === 0}
              aria-label="Google Image Search"
              title={
                listingPhotos.length === 0
                  ? "Add eBay listing photos first"
                  : researchMode === "google"
                    ? "Click a photo to search, or click again to cancel"
                    : "Google Image Search — click then pick a photo"
              }
              className={`flex items-center justify-center rounded-lg border bg-white px-4 py-2 transition-all dark:bg-zinc-900 ${
                researchMode === "google"
                  ? "border-blue-500 ring-2 ring-blue-400 ring-offset-2 dark:border-blue-400 dark:ring-blue-500 dark:ring-offset-zinc-950"
                  : "border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              } ${
                listingPhotos.length === 0
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer"
              }`}
            >
              <span className="text-base font-medium leading-none tracking-tight">
                <span style={{ color: "#4285F4" }}>G</span>
                <span style={{ color: "#EA4335" }}>o</span>
                <span style={{ color: "#FBBC05" }}>o</span>
                <span style={{ color: "#4285F4" }}>g</span>
                <span style={{ color: "#34A853" }}>l</span>
                <span style={{ color: "#EA4335" }}>e</span>
              </span>
            </button>

            <button
              onClick={handleEbaySearch}
              disabled={!listing.title?.trim()}
              aria-label="eBay Search"
              title={
                !listing.title?.trim()
                  ? "Run AI analysis first"
                  : "eBay Search — search active listings using the title"
              }
              className={`flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 transition-colors dark:border-zinc-700 dark:bg-zinc-900 ${
                !listing.title?.trim()
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="text-base font-bold italic leading-none">
                <span style={{ color: "#E53238" }}>e</span>
                <span style={{ color: "#0064D2" }}>b</span>
                <span style={{ color: "#F5AF02" }}>a</span>
                <span style={{ color: "#86B817" }}>y</span>
              </span>
            </button>
          </div>

          {/* Photo Zones — stacked vertically */}
          <div className="mt-6 space-y-6">
            <div ref={ebayZoneWrapperRef}>
              <PhotoZone
                title="eBay Listing Photos"
                subtitle="Full quality photos for the listing (first = main image)"
                photos={listingPhotos}
                onPhotosChange={setListingPhotos}
                pickMode={researchMode === "google"}
                onPickPhoto={handlePickPhotoForGoogle}
              />
            </div>

            <PhotoZone
              title="AI Analysis Photos"
              subtitle="Up to 8 photos for AI to analyze (compressed to 600px)"
              photos={aiPhotos}
              onPhotosChange={setAiPhotos}
              maxPhotos={8}
            />
          </div>

          {/* Analyze + Save Draft Buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
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

            <button
              onClick={handleSaveDraft}
              disabled={savingDraft || loadingDraft}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {savingDraft ? "Saving..." : draftId ? "Update Draft" : "Save Draft"}
            </button>

            {saveDraftStatus && (
              <span
                className={`text-xs ${
                  saveDraftStatus.type === "success"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {saveDraftStatus.message}
              </span>
            )}

            {loadingDraft && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Loading draft...
              </span>
            )}
          </div>

          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {lookupStatus && !analyzing && (
            <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
              lookupStatus.includes("Found \"")
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

            {listing.observations?.brand && (
              <SoldComps
                observations={listing.observations}
                condition={listing.condition}
                onPriceSelect={handlePriceSelect}
              />
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <SuccessModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        onNewListing={handleNewListing}
        thumbnailUrl={listingPhotos[0]?.secure_url}
        listingUrl={submitStatus?.url}
        promoResult={submitStatus?.promoResult}
      />
    </div>
  );
}
