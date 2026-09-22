"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import useListingForm from "@/hooks/useListingForm";
import { listButtonLabel, missingRequired } from "@/lib/listingDefaults";
import { shortItemName } from "@/lib/titleKeywords";
import { ClockIcon, MoreIcon, PlusIcon, SearchIcon, Spinner, TrashIcon } from "@/components/ui/Icons";
import HoldDialog from "@/components/create/HoldDialog";
import PhotoZone from "@/components/create/PhotoZone";
import Notes from "@/components/create/Notes";
import { PhonePin, PhoneTopLane } from "@/components/create/status";
import { DeleteDraftDialog, LeaveDialog } from "@/components/create/dialogs";
import {
  CategoryField,
  ConditionFields,
  DescriptionField,
  Keywords,
  OptionsGroup,
  PricingFields,
  ShippingFields,
  SkuField,
  Specifics,
  TitleField,
} from "@/components/create/fields";

const TABS = [
  ["photos", "Photos"],
  ["details", "Details"],
  ["specifics", "Specifics"],
  ["price", "Price"],
  ["ship", "Ship"],
];

// Phone (and every window smaller than the desktop layout): five tabs in the
// order the work happens. Four things never scroll: the header, the top lane
// (what the app just did to the draft), the pinned strip (the List on eBay
// result) and the action bar.
export default function PhoneCreate({ editor }) {
  const e = editor;
  const [tab, setTab] = useState("photos");
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef(null);
  const missing = missingRequired(e.listing);
  const heading = shortItemName(e.listing.title, e.listing.observations) || "Create Listing";
  const saveLabel = e.savingDraft ? "Saving…" : e.draftId ? "Update Draft" : "Save Draft";
  const canAnalyze = e.aiPhotos.length > 0 && !e.analyzing && !e.loadingDraft;

  const pickTab = (t) => {
    setTab(t);
    if (mainRef.current) mainRef.current.scrollTop = 0;
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-[640px] flex-col bg-bg">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-3">
        <h1 className="m-0 min-w-0 truncate text-2xl font-semibold tracking-[-0.01em]">{heading}</h1>
        {e.draftId ? (
          <span className="badge mono shrink-0">{e.listing.sku?.trim() || "No SKU"}</span>
        ) : (
          <span className="badge border-dashed border-line-strong bg-sunken font-medium text-ink-3">
            New · not saved
          </span>
        )}
        <div className="grow" />
        <button
          type="button"
          aria-label="More actions"
          onClick={() => setMenuOpen(true)}
          className="flex size-9 cursor-pointer items-center justify-center rounded-panel border-0 bg-transparent text-ink-2"
        >
          <MoreIcon className="size-[19px]" />
        </button>
      </header>

      <PhoneTopLane editor={e} />

      <nav aria-label="Listing sections" className="flex h-11 shrink-0 justify-between gap-0.5 border-b border-line bg-panel px-1.5">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className="tab" aria-pressed={tab === key} onClick={() => pickTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      <main
        ref={mainRef}
        className={`relative flex min-h-0 grow flex-col overflow-y-auto bg-panel p-3 transition-opacity duration-150 ${
          e.loadingDraft ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {e.caughtUp ? (
          <div className="flex grow items-center justify-center">
            <p className="m-0 text-[20px] font-semibold tracking-[-0.01em]">You&apos;re all caught up 🎉</p>
          </div>
        ) : (
          <>
            <div className={tab === "photos" ? "flex flex-col gap-3.5" : "hidden"}>
              <PhotosTab editor={e} />
            </div>
            <PhoneForm key={e.session} editor={e} tab={tab} />
          </>
        )}
      </main>

      <PhonePin editor={e} />

      <div className="flex shrink-0 gap-2 border-t border-line bg-panel px-3 pb-[22px] pt-[9px]">
        <button type="button" className="btn btn-touch shrink-0 px-3 text-md" disabled={!canAnalyze} onClick={e.analyze}>
          {e.analyzing && <Spinner className="size-3.5" />}
          Analyze
        </button>
        <button
          type="button"
          className="btn btn-touch min-w-[106px] shrink-0 px-3 text-md"
          disabled={e.savingDraft || e.loadingDraft || e.submitting}
          onClick={e.saveDraft}
        >
          {e.savingDraft && <Spinner className="size-3.5" />}
          {saveLabel}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-touch min-w-0 grow"
          disabled={missing || e.submitting || e.loadingDraft}
          onClick={e.submit}
        >
          {e.submitting && <Spinner className="size-3.5" />}
          <span className="truncate">{e.submitting ? "Listing on eBay…" : listButtonLabel(e.listing)}</span>
        </button>
      </div>

      {menuOpen && (
        <div
          className="scrim !items-end !p-0"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setMenuOpen(false);
          }}
        >
          <div className="bsheet w-full max-w-[640px]">
            <div className="grab" />
            <button
              type="button"
              className="srow"
              disabled={e.busy}
              onClick={() => {
                setMenuOpen(false);
                e.newListing();
              }}
            >
              <PlusIcon className="size-5" />
              New listing
            </button>
            {e.draftId && (
              <button
                type="button"
                className="srow srow-bad"
                disabled={e.busy}
                onClick={() => {
                  setMenuOpen(false);
                  e.askDelete();
                }}
              >
                <TrashIcon className="size-5" />
                Delete Draft
              </button>
            )}
          </div>
        </div>
      )}

      <LeaveDialog editor={e} touch />
      <DeleteDraftDialog editor={e} touch />
    </div>
  );
}

function PhotosTab({ editor: e }) {
  const zoneRef = useRef(null);
  const googleRef = useRef(null);
  // Seasonal Hold: park the finished draft until its season.
  const [holdOpen, setHoldOpen] = useState(false);
  const picking = e.researchMode === "google";

  // Google pick mode: jump up to the listing photos (the button sits below
  // them), and cancel only on a real TAP elsewhere — a "click", which a
  // scroll swipe never produces. (Touching down to scroll used to cancel it.)
  useEffect(() => {
    if (!picking) return;
    zoneRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    function onTap(ev) {
      if (zoneRef.current?.contains(ev.target)) return;
      if (googleRef.current?.contains(ev.target)) return;
      e.cancelGoogleMode();
    }
    document.addEventListener("click", onTap);
    return () => document.removeEventListener("click", onTap);
  }, [picking, e]);

  const hasTitle = !!e.listing.title?.trim();

  return (
    <>
      <div ref={zoneRef} className="scroll-mt-3">
        {picking && <p className="hint mb-[7px] font-medium text-warn">Tap a photo to search on Google.</p>}
        <PhotoZone
          title="eBay Listing Photos"
          photos={e.listingPhotos}
          onPhotosChange={e.setListingPhotos}
          pickMode={picking}
          onPickPhoto={e.pickPhotoForGoogle}
          showMain
          touch
        />
      </div>
      <PhotoZone title="AI Analysis Photos" photos={e.aiPhotos} onPhotosChange={e.setAiPhotos} maxPhotos={8} touch />

      <div>
        <h2 className="lbl mb-[7px]">Research</h2>
        <div className="flex gap-2">
          <button
            ref={googleRef}
            type="button"
            className={`btn btn-touch flex-1 ${picking ? "btn-active" : ""}`}
            disabled={e.listingPhotos.length === 0}
            onClick={e.toggleGoogleMode}
          >
            <SearchIcon className="size-4" />
            Google
          </button>
          <button type="button" className="btn btn-touch flex-1" disabled={!hasTitle} onClick={e.ebaySearch}>
            <SearchIcon className="size-4" />
            eBay
          </button>
        </div>
      </div>

      <Notes editor={e} touch />

      {e.draftId ? (
        <div>
          <label className="flex min-h-touch cursor-pointer items-center gap-2.5 text-lg font-medium">
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-[var(--color-accent)]"
              checked={!!e.listing.skipDraft}
              disabled={e.skipSaving}
              onChange={(ev) => e.toggleSkip(ev.target.checked)}
            />
            Skip Draft
            {e.skipSaving && <Spinner className="size-3.5 text-ink-3" />}
            {e.skipFlash && <span className="text-base font-medium text-ok">Saved</span>}
          </label>
          <p className="hint">
            Saves the moment you tick it. The draft keeps its place in the queue — only Next draft
            passes over it.
          </p>
        </div>
      ) : (
        <p className="hint">
          Skip Draft and Delete Draft appear once this is a draft — tap Save Draft to add it to the
          queue.
        </p>
      )}

      <button type="button" className="btn btn-touch w-full" onClick={() => setHoldOpen(true)} disabled={e.busy}>
        <ClockIcon className="size-4" />
        Hold until…
      </button>
      <HoldDialog editor={e} open={holdOpen} onClose={() => setHoldOpen(false)} touch />

      <Link href="/library" className="btn btn-touch w-full">
        Open Photo Library
      </Link>
    </>
  );
}

// Mounted once per session (keyed by it in PhoneCreate). Every tab stays
// mounted and is only hidden, so a half-typed title survives a trip to Ship.
function PhoneForm({ editor: e, tab }) {
  const form = useListingForm(e.listing, e.formSetters(e.session));
  const p = { listing: e.listing, form, touch: true };
  const show = (t) => (tab === t ? "flex flex-col gap-3.5" : "hidden");

  return (
    <>
      <div className={show("details")}>
        <TitleField {...p} />
        <Keywords {...p} />
        <CategoryField {...p} />
        <SkuField {...p} />
        <ConditionFields {...p} />
        <DescriptionField {...p} />
      </div>
      <div className={show("specifics")}>
        <Specifics {...p} />
      </div>
      <div className={show("price")}>
        <PricingFields {...p} />
        <OptionsGroup {...p} />
      </div>
      <div className={show("ship")}>
        <ShippingFields {...p} />
        <p className="hint">Photos upload in the order shown; the first is the gallery image.</p>
      </div>
    </>
  );
}
