"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePhotoTransfer } from "@/contexts/PhotoTransferContext";
import { applyDescriptionTemplate } from "@/lib/descriptionTemplate";
import { INITIAL_LISTING, blankListingKeepingDefaults } from "@/lib/listingDefaults";

// Everything Create Listing does, shared by the desktop and phone layouts:
// the listing and its photos, Analyze, Save / Update Draft, List on eBay,
// and the draft queue (open, Next draft, Skip Draft, Delete Draft, New
// listing, and the Save / Discard / Cancel prompt).
//
// SESSIONS. Each time a different listing is put in the form (a draft is
// opened, New listing, Next draft, after a delete) `session` goes up. The
// form is re-mounted per session and every change it makes is tagged with
// the session it came from, so a slow category / item-specifics lookup that
// finishes after you've switched drafts is thrown away instead of landing on
// the new draft.
//
// UNSAVED CHANGES are tracked by what the user does (typing, photos, notes,
// Analyze), not by comparing snapshots: the form fills in some fields by
// itself after a draft opens (policies, condition), and those must not count.

// Oldest first by creation date — what makes Next draft the next row down.
function sortDrafts(list) {
  return [...list].sort((a, b) =>
    (a.createdAt || a.updatedAt || "") < (b.createdAt || b.updatedAt || "") ? -1 : 1
  );
}

function setDraftInUrl(id) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("draft", id);
  else url.searchParams.delete("draft");
  window.history.replaceState({}, "", url);
}

export default function useListingEditor() {
  const { hasPending, consumeTransfer } = usePhotoTransfer();

  const [listing, setListing] = useState(INITIAL_LISTING);
  const [aiPhotos, setAiPhotosState] = useState([]);
  const [listingPhotos, setListingPhotosState] = useState([]);
  const [draftId, setDraftId] = useState(null);
  const [session, setSession] = useState(0);
  const sessionRef = useRef(0);
  const [dirty, setDirtyState] = useState(false);
  const dirtyRef = useRef(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [lookup, setLookup] = useState(null); // { kind, styleNumber, styleName }
  const [error, setError] = useState("");
  const [draftError, setDraftError] = useState(""); // stored on an Error draft
  const [notice, setNotice] = useState(null); // { kind: "deleted" }

  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const [savingDraft, setSavingDraft] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loadingDraft, setLoadingDraft] = useState(false);

  const [skipSaving, setSkipSaving] = useState(false);
  const [skipFlash, setSkipFlash] = useState(false);

  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [draftsError, setDraftsError] = useState("");
  const [caughtUp, setCaughtUp] = useState(false);

  // Save / Discard / Cancel prompt. `run` continues the switch.
  const [leavePrompt, setLeavePrompt] = useState(null);
  const [deletePrompt, setDeletePrompt] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [researchMode, setResearchMode] = useState(null); // 'google' | null

  const busy = analyzing || savingDraft || submitting || loadingDraft || deleting;

  // --- dirty tracking -----------------------------------------------------
  const setDirty = useCallback((v) => {
    dirtyRef.current = v;
    setDirtyState(v);
  }, []);

  const newSession = useCallback(() => {
    sessionRef.current += 1;
    setSession(sessionRef.current);
  }, []);

  // Changes made by the user: accepted and mark the listing as edited.
  const updateListing = useCallback(
    (next) => {
      setListing(next);
      setDirty(true);
    },
    [setDirty]
  );

  // Saved settings (categories + policies), loaded once per page and shared
  // by every session's form.
  const settingsRef = useRef(null);
  const getSettings = useCallback(() => {
    if (!settingsRef.current) {
      settingsRef.current = fetch("/api/settings", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null);
    }
    return settingsRef.current;
  }, []);

  // Setters handed to the form for one session. Late changes from an old
  // session are dropped.
  const formSetters = useCallback(
    (s) => ({
      getSettings,
      onUser: (next) => {
        if (s !== sessionRef.current) return;
        updateListing(next);
      },
      onAuto: (next) => {
        if (s !== sessionRef.current) return;
        setListing(next);
      },
    }),
    [updateListing, getSettings]
  );

  const setAiPhotos = useCallback(
    (next) => {
      setAiPhotosState(next);
      setDirty(true);
    },
    [setDirty]
  );
  const setListingPhotos = useCallback(
    (next) => {
      setListingPhotosState(next);
      setDirty(true);
    },
    [setDirty]
  );

  // --- drafts list ----------------------------------------------------------
  // Refreshes ONLY on: opening the page, save, publish, Next draft, Refresh.
  const refreshDrafts = useCallback(async () => {
    setDraftsLoading(true);
    setDraftsError("");
    try {
      const res = await fetch("/api/drafts", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        const sorted = sortDrafts(data.drafts || []);
        setDrafts(sorted);
        setDraftsLoaded(true);
        return sorted;
      }
      setDraftsError(data.error || "Failed to load drafts");
    } catch {
      setDraftsError("Could not load drafts");
    } finally {
      setDraftsLoading(false);
    }
    return null;
  }, []);

  // --- put a listing in the form -----------------------------------------
  const clearStatus = useCallback(() => {
    setSubmitStatus(null);
    setError("");
    setLookup(null);
    setAnalysisStep("");
    setSaveError("");
    setDraftError("");
    setNotice(null);
    setSaveFlash(false);
    setSkipFlash(false);
    setResearchMode(null);
  }, []);

  const loadDraft = useCallback(
    async (id) => {
      setLoadingDraft(true);
      setError("");
      try {
        const res = await fetch(`/api/drafts/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (data.success && data.draft) {
          clearStatus();
          setListing({ ...INITIAL_LISTING, ...(data.draft.listing || {}) });
          setAiPhotosState(data.draft.aiPhotos || []);
          setListingPhotosState(data.draft.listingPhotos || []);
          setDraftId(id);
          setDraftInUrl(id);
          setDirty(false);
          setCaughtUp(false);
          if (data.draft.status === "error") {
            setDraftError(data.draft.errorMessage || "This draft failed to process.");
          }
          newSession();
          return true;
        }
        setError(data.error || "Failed to load draft");
      } catch (err) {
        setError("Could not load draft: " + err.message);
      } finally {
        setLoadingDraft(false);
      }
      return false;
    },
    [clearStatus, newSession, setDirty]
  );

  const clearToBlank = useCallback(
    ({ keepNotice } = {}) => {
      const n = keepNotice || null;
      clearStatus();
      setNotice(n);
      setListing((prev) => blankListingKeepingDefaults(prev));
      setAiPhotosState([]);
      setListingPhotosState([]);
      setDraftId(null);
      setDraftInUrl(null);
      setDirty(false);
      newSession();
    },
    [clearStatus, newSession, setDirty]
  );

  // Load ?draft=… on first visit, and the drafts list.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("draft");
    if (id) loadDraft(id);
    refreshDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Photos sent from the Library page (each batch taken exactly once).
  const consumedRef = useRef(null);
  useEffect(() => {
    if (!hasPending) return;
    const batch = consumeTransfer();
    if (consumedRef.current === batch) return;
    consumedRef.current = batch;
    const { listing: toListing, ai } = batch;
    if (toListing.length > 0) setListingPhotosState((prev) => [...prev, ...toListing]);
    if (ai.length > 0) setAiPhotosState((prev) => [...prev, ...ai]);
    if (toListing.length > 0 || ai.length > 0) setDirty(true);
  }, [hasPending, consumeTransfer, setDirty]);

  // --- save -----------------------------------------------------------------
  const saveDraft = useCallback(async () => {
    if (savingDraft) return false;
    setSavingDraft(true);
    setSaveError("");
    setSaveFlash(false);
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
        setDraftInUrl(data.id);
        setDirty(false);
        setDraftError("");
        setNotice(null);
        setSaveFlash(true);
        setTimeout(() => setSaveFlash(false), 3000);
        refreshDrafts();
        return true;
      }
      setSaveError(data.error || "Save failed");
    } catch (err) {
      setSaveError(`Save failed: ${err.message}`);
    } finally {
      setSavingDraft(false);
    }
    return false;
  }, [savingDraft, draftId, listing, aiPhotos, listingPhotos, setDirty, refreshDrafts]);

  // --- switching with the unsaved-changes prompt --------------------------
  const guardSwitch = useCallback(
    (run) => {
      if (busy) return;
      if (dirtyRef.current) setLeavePrompt({ run });
      else run();
    },
    [busy]
  );

  const leaveCancel = useCallback(() => setLeavePrompt(null), []);
  const leaveDiscard = useCallback(() => {
    const p = leavePrompt;
    setLeavePrompt(null);
    p?.run();
  }, [leavePrompt]);
  const leaveSave = useCallback(async () => {
    const p = leavePrompt;
    const ok = await saveDraft();
    setLeavePrompt(null);
    if (ok) p?.run();
  }, [leavePrompt, saveDraft]);

  const openDraft = useCallback(
    (id) => {
      if (!id || id === draftId) return;
      guardSwitch(() => loadDraft(id));
    },
    [draftId, guardSwitch, loadDraft]
  );

  const newListing = useCallback(() => {
    guardSwitch(() => {
      setCaughtUp(false);
      clearToBlank();
    });
  }, [guardSwitch, clearToBlank]);

  // Next draft: refresh the list first, then open the oldest draft that is
  // neither skipped nor still processing (Error drafts included).
  const nextDraft = useCallback(() => {
    guardSwitch(async () => {
      const list = (await refreshDrafts()) || drafts;
      const next = list.find(
        (d) => !d.skipped && d.status !== "processing" && d.id !== draftId
      );
      if (next) {
        await loadDraft(next.id);
      } else {
        clearToBlank();
        setCaughtUp(true);
      }
    });
  }, [guardSwitch, refreshDrafts, drafts, draftId, loadDraft, clearToBlank]);

  // --- Skip Draft: saves the instant it is ticked, and only that ----------
  const toggleSkip = useCallback(
    async (checked) => {
      if (!draftId || skipSaving) return;
      setSkipSaving(true);
      setSkipFlash(false);
      setSaveError("");
      try {
        const res = await fetch(`/api/drafts/${encodeURIComponent(draftId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skipDraft: checked }),
        });
        const data = await res.json();
        if (data.success) {
          setListing((prev) => ({ ...prev, skipDraft: checked }));
          setDrafts((prev) =>
            prev.map((d) => (d.id === draftId ? { ...d, skipped: checked } : d))
          );
          setSkipFlash(true);
          setTimeout(() => setSkipFlash(false), 2500);
        } else {
          setSaveError(data.error || "Couldn't save Skip Draft");
        }
      } catch {
        setSaveError("Couldn't save Skip Draft");
      } finally {
        setSkipSaving(false);
      }
    },
    [draftId, skipSaving]
  );

  // --- Delete Draft (after its confirm) ----------------------------------
  const confirmDelete = useCallback(async () => {
    if (!draftId) return;
    const id = draftId;
    setDeleting(true);
    try {
      const res = await fetch(`/api/drafts/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDeletePrompt(false);
        setDrafts((prev) => prev.filter((d) => d.id !== id));
        setCaughtUp(false);
        clearToBlank({ keepNotice: { kind: "deleted" } });
      } else {
        setSaveError(data.error || "Delete failed");
        setDeletePrompt(false);
      }
    } catch (err) {
      setSaveError(`Delete failed: ${err.message}`);
      setDeletePrompt(false);
    } finally {
      setDeleting(false);
    }
  }, [draftId, clearToBlank]);

  // --- Analyze -------------------------------------------------------------
  const analyze = useCallback(async () => {
    // Re-analyzing redoes the listing from the photos, replacing what the AI
    // created. Confirm first so a stray click can't wipe a finished listing.
    if (
      listing.title?.trim() &&
      !window.confirm(
        "Redo this listing from the photos?\n\nThe AI will redo the title, keywords, condition, description, category, and item specifics. Your photos, notes, price, SKU, weight, dimensions, and policies stay.\n\nNothing is saved until you click Update Draft."
      )
    ) {
      return;
    }
    const s = sessionRef.current;
    setAnalyzing(true);
    setError("");
    setLookup(null);
    setSubmitStatus(null);
    setAnalysisStep("Analyzing photos…");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: aiPhotos, notes: listing.aiNote }),
      });
      const data = await res.json();
      if (s !== sessionRef.current) return;
      if (data.success) {
        const aiListing = { ...data.listing };

        // Style number lookup: if Pass 1 found a style number, search for the model name
        const styleNumber = aiListing.observations?.style_number;
        if (styleNumber) {
          try {
            setAnalysisStep(`Looking up style number ${styleNumber}…`);
            const refineRes = await fetch("/api/generate/refine", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ listing: aiListing }),
            });
            const refineData = await refineRes.json();
            if (refineData.success && refineData.listing) {
              Object.assign(aiListing, refineData.listing);
              const styleName = refineData.listing.observations?.style_name;
              setLookup({ kind: styleName ? "found" : "none", styleNumber, styleName });
            } else {
              setLookup({ kind: "none", styleNumber });
            }
          } catch (err) {
            setLookup({ kind: "failed", styleNumber });
            console.error("Style lookup failed:", err);
          }
        }
        if (s !== sessionRef.current) return;

        // Title rules, 2-inch asterisk, description, condition boilerplate —
        // shared with the camera flow so both produce identical drafts.
        const finalListing = applyDescriptionTemplate(aiListing);

        // Start from square one for everything the AI creates; keep what the
        // user typed (price, SKU, weight, policies, notes…).
        updateListing((prev) => ({
          ...prev,
          ...finalListing,
          categoryId: "",
          categoryName: "",
          itemSpecifics: {},
          analysisRun: Date.now(),
        }));
      } else {
        setError(`Analysis failed: ${data.error || "unknown error"}`);
      }
    } catch {
      if (s === sessionRef.current) setError("Could not connect to AI service");
    } finally {
      setAnalyzing(false);
      setAnalysisStep("");
    }
  }, [listing.title, listing.aiNote, aiPhotos, updateListing]);

  // --- List on eBay --------------------------------------------------------
  const submit = useCallback(async () => {
    // SKU is required — never post without one (the server checks too).
    if (!String(listing.sku || "").trim()) {
      setSubmitStatus({
        type: "error",
        message: "Failed: SKU is required. Add a SKU before posting. Nothing was posted.",
        step: "sku_check",
      });
      return;
    }
    setSubmitting(true);
    setSubmitStatus(null);
    const publishedDraft = draftId;
    try {
      const res = await fetch("/api/ebay/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...listing, photos: listingPhotos }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitStatus({
          type: "success",
          listingId: data.listingId,
          url: data.url,
          promoResult: data.promoResult || "",
          thumbnailUrl: listingPhotos[0]?.secure_url || "",
        });
        setDraftError("");
        setNotice(null);
        // The draft has been published — delete it, then refresh the list so
        // its row disappears.
        setDraftId(null);
        setDraftInUrl(null);
        setDirty(false);
        if (publishedDraft) {
          try {
            await fetch(`/api/drafts/${encodeURIComponent(publishedDraft)}`, {
              method: "DELETE",
            });
          } catch {
            // Non-fatal — listing already published
          }
        }
        refreshDrafts();
      } else {
        setSubmitStatus({ type: "error", message: `Failed: ${data.error}`, step: data.step });
      }
    } catch (err) {
      setSubmitStatus({ type: "error", message: `Connection error: ${err.message}` });
    } finally {
      setSubmitting(false);
    }
  }, [listing, listingPhotos, draftId, setDirty, refreshDrafts]);

  // --- research ------------------------------------------------------------
  const toggleGoogleMode = useCallback(() => {
    if (listingPhotos.length === 0) return;
    setResearchMode((prev) => (prev === "google" ? null : "google"));
  }, [listingPhotos.length]);

  useEffect(() => {
    if (researchMode === "google" && listingPhotos.length === 0) setResearchMode(null);
  }, [researchMode, listingPhotos.length]);

  const pickPhotoForGoogle = useCallback((photo) => {
    if (!photo?.secure_url) return;
    const url = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(photo.secure_url)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setResearchMode(null);
  }, []);

  const ebaySearch = useCallback(() => {
    // Brand + Style Name + Item Type from the TITLE verbatim, dropping size,
    // gender, color and extras.
    //   1. Type-anchor — find observations.type in the title (case- and
    //      dash-insensitive) and cut everything after it.
    //   2. Stop-word fallback — cut at the first gender word or size.
    const title = listing.title?.trim();
    if (!title) return;

    let working = title.replace(/^NWT\s+/i, "");
    let cutDone = false;

    const type = listing.observations?.type;
    if (type) {
      const typeWords = type
        .toLowerCase()
        .split(/[\s-]+/)
        .filter(Boolean)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      if (typeWords.length) {
        const typePattern = new RegExp(`\\b${typeWords.join("[\\s-]+")}\\b`, "i");
        const typeMatch = working.match(typePattern);
        if (typeMatch) {
          working = working.substring(0, typeMatch.index + typeMatch[0].length).trim();
          cutDone = true;
        }
      }
    }

    if (!cutDone) {
      const stopRegex =
        /\b(?:Mens|Womens|Boys|Girls|Unisex|XS|XXS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL|6XL|7XL|Small|Medium|Large|X-Small|X-Large|XX-Large|XXX-Large|\d{2}x\d{2}\*?)\b/i;
      const stopMatch = working.match(stopRegex);
      if (stopMatch) working = working.substring(0, stopMatch.index).trim();
    }

    if (!working) return;
    window.open(
      `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(working)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, [listing.title, listing.observations]);

  return {
    // listing
    listing,
    aiPhotos,
    listingPhotos,
    setAiPhotos,
    setListingPhotos,
    updateListing,
    formSetters,
    session,
    draftId,
    dirty,
    busy,
    // status
    analyzing,
    analysisStep,
    lookup,
    dismissLookup: () => setLookup(null),
    error,
    draftError,
    notice,
    dismissNotice: () => setNotice(null),
    submitting,
    submitStatus,
    dismissSubmitStatus: () => setSubmitStatus(null),
    savingDraft,
    saveFlash,
    saveError,
    loadingDraft,
    skipSaving,
    skipFlash,
    // queue
    drafts,
    draftsLoading,
    draftsLoaded,
    draftsError,
    refreshDrafts,
    caughtUp,
    openDraft,
    nextDraft,
    newListing,
    toggleSkip,
    // prompts
    leavePrompt,
    leaveCancel,
    leaveDiscard,
    leaveSave,
    deletePrompt,
    askDelete: () => setDeletePrompt(true),
    cancelDelete: () => setDeletePrompt(false),
    confirmDelete,
    deleting,
    // actions
    analyze,
    saveDraft,
    submit,
    // research
    researchMode,
    toggleGoogleMode,
    cancelGoogleMode: () => setResearchMode(null),
    pickPhotoForGoogle,
    ebaySearch,
  };
}
