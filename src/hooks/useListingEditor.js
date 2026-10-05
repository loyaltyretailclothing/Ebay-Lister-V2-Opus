"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePhotoTransfer } from "@/contexts/PhotoTransferContext";
import { applyDescriptionTemplate } from "@/lib/descriptionTemplate";
import { INITIAL_LISTING, blankListingKeepingDefaults } from "@/lib/listingDefaults";
import { getCategories, getSpecifics } from "@/lib/ebayCache";
import { promoInfo } from "@/components/create/status";
import { shortItemName } from "@/lib/titleKeywords";
import { createActiveClock } from "@/lib/activeClock";
import { buildDraftEntry, cleanMs } from "@/lib/efficiency";
import { describeFailure, readReply } from "@/lib/publishError";
import { matchPublished } from "@/lib/skuMatch";

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

// Oldest first by creation date â€” what makes Next draft the next row down.
function sortDrafts(list) {
  return [...list].sort((a, b) =>
    (a.createdAt || a.updatedAt || "") < (b.createdAt || b.updatedAt || "") ? -1 : 1
  );
}

// After a publish that gave no reason, ask eBay whether the item went live
// anyway. Only accepted when the item eBay holds under that SKU has the
// title we were publishing, so a SKU that was genuinely already in use can
// never be mistaken for our own listing. See src/lib/skuInspect.js.
async function recoverListing(listing) {
  const sku = String(listing?.sku || "").trim();
  if (!sku || !listing?.title?.trim()) return null;
  try {
    const found = await fetch(`/api/ebay/sku-inspect?sku=${encodeURIComponent(sku)}`, {
      cache: "no-store",
    }).then((r) => r.json());
    if (!found?.success) return null;
    const live = matchPublished(found, listing.title);
    return live ? { success: true, recovered: true, ...live } : null;
  } catch {
    return null; // couldn't ask — leave it as a failure
  }
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
  const [submitStatus, setSubmitStatus] = useState(null); // failures only
  // "Listed on eBay!" â€” outlives the switch to the next draft and clears
  // itself after 10 seconds (a promotion problem stays until dismissed).
  const [listed, setListed] = useState(null);
  const listedTimer = useRef(null);
  // "Held for Winter â€” posts itself on â€¦", same idea.
  const [held, setHeld] = useState(null);
  const heldTimer = useRef(null);

  const [savingDraft, setSavingDraft] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [openingId, setOpeningId] = useState(null); // draft being opened

  const [skipSaving, setSkipSaving] = useState(false);
  const [skipFlash, setSkipFlash] = useState(false);
  // The open draft's place in Anthropic's queue, if it has one:
  // { id, phase, at }. Pulling it out happens here, inside the draft, so a
  // stray tap in the drafts list can't set it off.
  const [openBatch, setOpenBatch] = useState(null);
  const [forcing, setForcing] = useState(false);
  const [queueing, setQueueing] = useState(false);

  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [draftsError, setDraftsError] = useState("");
  const [caughtUp, setCaughtUp] = useState(false);
  const [heldCount, setHeldCount] = useState(0);

  // Save / Discard / Cancel prompt. `run` continues the switch.
  const [leavePrompt, setLeavePrompt] = useState(null);
  const [deletePrompt, setDeletePrompt] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [researchMode, setResearchMode] = useState(null); // 'google' | null

  const busy = analyzing || savingDraft || submitting || loadingDraft || deleting;

  // --- Efficiency Tracker: active time finishing each listing -------------
  // Counts while a listing is in the form (active time only, see
  // lib/activeClock). A draft left and reopened later keeps adding up: the
  // time is saved on the draft (listing.timing.finishMs) with Save/Update
  // Draft, and remembered for this page visit even if it isn't saved.
  const clockRef = useRef(null);
  const timedIdRef = useRef(null); // draft being timed (null = unsaved listing)
  const finishBaseRef = useRef(0); // earlier sittings for that draft
  const analysesRef = useRef(0);
  const sittingsRef = useRef(new Map()); // draftId â†’ ms, this page visit
  useEffect(() => {
    clockRef.current = createActiveClock();
    return () => clockRef.current?.stop();
  }, []);
  const finishSoFar = useCallback(
    () => finishBaseRef.current + (clockRef.current?.read() || 0),
    []
  );
  // listing.timing with the finishing time so far (saved with the draft).
  const timingForSave = useCallback(
    (l) => ({
      ...(l.timing || {}),
      finishMs: Math.round(finishSoFar()),
      analyses: analysesRef.current,
    }),
    [finishSoFar]
  );
  const startTiming = useCallback((nextId, saved) => {
    const took = clockRef.current?.take() || 0;
    if (timedIdRef.current) {
      sittingsRef.current.set(timedIdRef.current, finishBaseRef.current + took);
    }
    timedIdRef.current = nextId || null;
    finishBaseRef.current = Math.max(
      cleanMs(saved?.finishMs),
      (nextId && sittingsRef.current.get(nextId)) || 0
    );
    analysesRef.current = parseInt(saved?.analyses, 10) || 0;
  }, []);

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
  const settingsResolvedRef = useRef(null);
  const getSettings = useCallback(() => {
    if (!settingsRef.current) {
      settingsRef.current = fetch("/api/settings", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          settingsResolvedRef.current = data;
          return data;
        })
        .catch(() => null);
    }
    return settingsRef.current;
  }, []);
  const peekSettings = useCallback(() => settingsResolvedRef.current, []);

  // Setters handed to the form for one session. Late changes from an old
  // session are dropped.
  const formSetters = useCallback(
    (s) => ({
      getSettings,
      peekSettings,
      onUser: (next) => {
        if (s !== sessionRef.current) return;
        updateListing(next);
      },
      onAuto: (next) => {
        if (s !== sessionRef.current) return;
        setListing(next);
      },
    }),
    [updateListing, getSettings, peekSettings]
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
        const all = data.drafts || [];
        // Held drafts wait on the On Hold page â€” they're out of the queue.
        const sorted = sortDrafts(all.filter((d) => !d.holdUntil));
        setHeldCount(all.length - sorted.length);
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

  // Opening a draft is ONE visible step: the current listing stays on screen
  // (faded) while the draft and everything its form needs â€” saved settings,
  // the category's item specifics, category suggestions â€” are fetched; then
  // the new draft is swapped in complete. No strip appears and nothing jumps.
  const loadDraft = useCallback(
    async (id) => {
      setLoadingDraft(true);
      setOpeningId(id);
      setError("");
      try {
        const res = await fetch(`/api/drafts/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (data.success && data.draft) {
          const l = data.draft.listing || {};
          await Promise.all([
            getSettings(),
            getSpecifics(l.categoryId).catch(() => null),
            getCategories(l.category_keywords).catch(() => null),
          ]);
          clearStatus();
          // Older drafts saved Schedule as on by default with no date (which
          // never scheduled anything); show those as off.
          setListing({
            ...INITIAL_LISTING,
            ...l,
            scheduleEnabled: !!(l.scheduleEnabled && l.scheduledDate),
          });
          setAiPhotosState(data.draft.aiPhotos || []);
          setListingPhotosState(data.draft.listingPhotos || []);
          // Still waiting on Anthropic's queue? The lane says so and offers
          // to run it now. See docs/Plans/Batch Analysis Plan.md.
          setOpenBatch(data.draft.batch?.phase ? data.draft.batch : null);
          startTiming(id, l.timing);
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
        setOpeningId(null);
      }
      return false;
    },
    [clearStatus, newSession, setDirty, getSettings, startTiming]
  );

  const clearToBlank = useCallback(
    ({ keepNotice } = {}) => {
      const n = keepNotice || null;
      clearStatus();
      setNotice(n);
      setListing((prev) => blankListingKeepingDefaults(prev));
      setAiPhotosState([]);
      setListingPhotosState([]);
      setOpenBatch(null);
      startTiming(null, null);
      setDraftId(null);
      setDraftInUrl(null);
      setDirty(false);
      newSession();
    },
    [clearStatus, newSession, setDirty, startTiming]
  );

  // Load ?draft=â€¦ on first visit, and the drafts list.
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
          listing: { ...listing, timing: timingForSave(listing) },
          aiPhotos,
          listingPhotos,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // A new listing saved for the first time: keep timing it as this draft.
        if (!timedIdRef.current) timedIdRef.current = data.id;
        setDraftId(data.id);
        setDraftInUrl(data.id);
        setDirty(false);
        setDraftError("");
        setNotice(null);
        setSaveFlash(true);
        setTimeout(() => setSaveFlash(false), 3000);
        refreshDrafts();
        // The id, not just true: setDraftId above won't be readable until the
        // next render, and Send To Queue needs it in the same breath.
        return data.id;
      }
      setSaveError(data.error || "Save failed");
    } catch (err) {
      setSaveError(`Save failed: ${err.message}`);
    } finally {
      setSavingDraft(false);
    }
    return false;
  }, [savingDraft, draftId, listing, aiPhotos, listingPhotos, setDirty, refreshDrafts, timingForSave]);

  // --- Seasonal Hold ------------------------------------------------------
  // Saves the finished draft with its posting date and moves on. The draft
  // leaves the queue; the app posts it on that morning by itself.
  const holdDraft = useCallback(
    async ({ date, season, cost, place }) => {
      if (savingDraft) return false;
      setSavingDraft(true);
      setSaveError("");
      try {
        const res = await fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: draftId || undefined,
            listing: {
              ...listing,
              holdUntil: date,
              holdSeason: season,
              // What it cost and where it came from â€” kept for the Listed
              // report, because the draft is gone once the item posts.
              cost: String(cost ?? "").trim(),
              purchasePlace: String(place ?? "").trim(),
              timing: timingForSave(listing),
            },
            aiPhotos,
            listingPhotos,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Couldn't hold this draft");
        setDirty(false);
        setDraftId(null);
        setDraftInUrl(null);
        timedIdRef.current = null;
        finishBaseRef.current = 0;
        // Outlives the switch to the next draft (like "Listed on eBay!").
        clearTimeout(heldTimer.current);
        setHeld({ date, season });
        heldTimer.current = setTimeout(() => setHeld(null), 8000);
        return true;
      } catch (err) {
        setSaveError(err.message);
        return false;
      } finally {
        setSavingDraft(false);
      }
    },
    [savingDraft, draftId, listing, aiPhotos, listingPhotos, setDirty, timingForSave]
  );

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

  // --- Analyze now: pull a draft out of Anthropic's queue -----------------
  // Cancels its place in the queue and runs the analysis on the spot (~45s
  // at full price). Anthropic doesn't bill a request it hadn't started, so
  // this normally costs nothing extra.
  const forceDraft = useCallback(async () => {
    if (!draftId || forcing) return;
    setForcing(true);
    setError("");
    try {
      const res = await fetch("/api/batches/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Couldn't analyze that draft");
      // Re-open it so the form shows what came back.
      await loadDraft(draftId);
      refreshDrafts();
    } catch (err) {
      setError(err.message);
    } finally {
      setForcing(false);
    }
  }, [draftId, forcing, loadDraft, refreshDrafts]);

  // --- Send To Queue: put a draft that never reached the queue back in ----
  // The opposite of Analyze now. When the submission fails — the Anthropic
  // account out of funds was the real case (2026-10-02), but any hiccup
  // reaching them does it — the draft is saved as an error with its photos
  // and there is no way back: "Analyze now" cancels a place in the queue,
  // and a draft that never got submitted has no place to cancel. Without
  // this the only way on was a fresh live analysis at full price.
  const sendToQueue = useCallback(async () => {
    if (queueing) return;
    setQueueing(true);
    setError("");
    try {
      // A listing built from scratch has photos but no draft yet — the queue
      // reads a SAVED draft, so save it first and queue the id that comes
      // back. Nothing else to ask of the user.
      const id = draftId || (await saveDraft());
      if (!id) throw new Error("Couldn't save this draft, so it wasn't queued");
      const res = await fetch("/api/drafts/requeue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Couldn't send that draft to the queue");
      const mine = (data.results || [])[0];
      if (mine?.error) throw new Error(mine.error);
      await loadDraft(id);
      refreshDrafts();
    } catch (err) {
      setError(err.message);
    } finally {
      setQueueing(false);
    }
  }, [draftId, queueing, saveDraft, loadDraft, refreshDrafts]);

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
  const confirmDelete = useCallback(async ({ deletePhotos = false } = {}) => {
    if (!draftId) return;
    const id = draftId;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/drafts/${encodeURIComponent(id)}${deletePhotos ? "?photos=1" : ""}`,
        { method: "DELETE" }
      );
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
    analysesRef.current += 1;
    setAnalyzing(true);
    setError("");
    setLookup(null);
    setSubmitStatus(null);
    setAnalysisStep("Analyzing photosâ€¦");
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
            setAnalysisStep(`Looking up style number ${styleNumber}â€¦`);
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

        // Title rules, 2-inch asterisk, description, condition boilerplate â€”
        // shared with the camera flow so both produce identical drafts.
        const finalListing = applyDescriptionTemplate(aiListing);

        // Start from square one for everything the AI creates; keep what the
        // user typed (price, SKU, weight, policies, notesâ€¦).
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
  const dismissListed = useCallback(() => {
    clearTimeout(listedTimer.current);
    setListed(null);
  }, []);

  const showListed = useCallback((info) => {
    clearTimeout(listedTimer.current);
    setListed(info);
    if (!promoInfo(info.promoResult).warn) {
      listedTimer.current = setTimeout(() => setListed(null), 10000);
    }
  }, []);

  useEffect(
    () => () => {
      clearTimeout(listedTimer.current);
      clearTimeout(heldTimer.current);
    },
    []
  );

  const submit = useCallback(async () => {
    // SKU is required â€” never post without one (the server checks too).
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
    dismissListed();
    const publishedDraft = draftId;
    try {
      const res = await fetch("/api/ebay/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...listing, photos: listingPhotos }),
      });
      // Read it as text first: a platform error (a timeout, an error page)
      // isn't our JSON, and guessing it is turns a useful reason into
      // "[object Object]" or a parse error.
      const { data, body } = await readReply(res);
      // No answer from our own route (a timeout, an error page) means we
      // don't know whether eBay listed it. Ask before calling it a failure:
      // a live listing treated as failed loses its Listed-report row and is
      // refused for reusing its SKU next time.
      const result =
        data?.success || typeof data?.error === "string"
          ? data
          : (await recoverListing(listing)) || data;

      if (result?.success) {
        showListed({
          listingId: result.listingId,
          url: result.url,
          promoResult: result.recovered ? "recovered" : result.promoResult || "",
        });
        // Efficiency Tracker (draft tracker): one entry for this listing.
        // Best-effort â€” a failed log never gets in the way of listing.
        const entry = buildDraftEntry({
          listing,
          finishMs: finishBaseRef.current + (clockRef.current?.take() || 0),
          analyses: analysesRef.current,
          listingId: result.listingId,
          listedAt: new Date().toISOString(),
        });
        if (publishedDraft) sittingsRef.current.delete(publishedDraft);
        timedIdRef.current = null;
        finishBaseRef.current = 0;
        fetch("/api/efficiency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        }).catch(() => {});

        // Listed report: HELD items only (users' call) â€” those are the ones
        // whose cost still has to go into Flipwise long after they were
        // finished. Items listed straight away are entered the same day.
        if (listing.holdUntil) {
          fetch("/api/listed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              at: new Date().toISOString(),
              listingId: result.listingId,
              title: listing.title,
              sku: listing.sku,
              cost: listing.cost,
              place: listing.purchasePlace,
              image: result.image,
              url: result.url,
              held: true,
            }),
          }).catch(() => {});
        }
        setDraftError("");
        setNotice(null);
        // The draft has been published â€” delete it.
        setDraftId(null);
        setDraftInUrl(null);
        setDirty(false);
        if (publishedDraft) {
          try {
            // A held draft's photos left the library when it was held; now
            // that it's live, they're deleted half an hour from now rather
            // than put back (eBay has its own copies). Items listed straight
            // away keep their photos in the library, as always.
            await fetch(
              `/api/drafts/${encodeURIComponent(publishedDraft)}${listing.holdUntil ? "?posted=1" : ""}`,
              { method: "DELETE" }
            );
          } catch {
            // Non-fatal â€” listing already published
          }
        }
        // Straight on to the next draft (same order as Next draft), or a
        // blank listing when none is waiting. `submitting` stays on until
        // then, so the listed item can't be sent twice.
        const list = await refreshDrafts();
        const next = (list || []).find(
          (d) => !d.skipped && d.status !== "processing" && d.id !== publishedDraft
        );
        setCaughtUp(false);
        if (!next || !(await loadDraft(next.id))) clearToBlank();
      } else {
        setSubmitStatus({
          type: "error",
          message: `Failed: ${describeFailure(res.status, data, body)}`,
          step: data?.step,
        });
      }
    } catch (err) {
      setSubmitStatus({ type: "error", message: `Connection error: ${err.message}` });
    } finally {
      setSubmitting(false);
    }
  }, [listing, listingPhotos, draftId, setDirty, refreshDrafts, showListed, dismissListed, loadDraft, clearToBlank]);

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
    // Brand + Style Name + Item Type from the title (see shortItemName).
    const working = shortItemName(listing.title, listing.observations);
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
    dismissError: () => {
      setError("");
      setSaveError("");
    },
    draftError,
    dismissDraftError: () => setDraftError(""),
    notice,
    dismissNotice: () => setNotice(null),
    submitting,
    submitStatus,
    dismissSubmitStatus: () => setSubmitStatus(null),
    listed,
    dismissListed,
    held,
    dismissHeld: () => {
      clearTimeout(heldTimer.current);
      setHeld(null);
    },
    savingDraft,
    saveFlash,
    saveError,
    loadingDraft,
    openingId,
    skipSaving,
    skipFlash,
    // queue
    drafts,
    draftsLoading,
    draftsLoaded,
    draftsError,
    refreshDrafts,
    caughtUp,
    heldCount,
    holdDraft,
    openDraft,
    nextDraft,
    newListing,
    toggleSkip,
    openBatch,
    forcing,
    forceDraft,
    queueing,
    sendToQueue,
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
