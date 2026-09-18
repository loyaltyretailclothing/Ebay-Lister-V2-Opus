"use client";

import { useEffect, useRef } from "react";
import useListingForm from "@/hooks/useListingForm";
import { listButtonLabel, missingRequired } from "@/lib/listingDefaults";
import { AnalyzeIcon, CheckIcon, PlusIcon, Spinner, TrashIcon } from "@/components/ui/Icons";
import LibraryPanel from "@/components/create/LibraryPanel";
import PhotoZone from "@/components/create/PhotoZone";
import Notes from "@/components/create/Notes";
import { DesktopLane, TopMessage } from "@/components/create/status";
import { shortItemName } from "@/lib/titleKeywords";
import { LeaveDialog, DeleteDraftDialog } from "@/components/create/dialogs";
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

// Desktop Create Listing (big windows): fixed action bar, status lane, and
// four columns — library/drafts panel · photos & notes · two independently
// scrolling form panes.
export default function DesktopCreate({ editor }) {
  const e = editor;
  const missing = missingRequired(e.listing);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <ActionBar editor={e} missing={missing} />
      <DesktopLane editor={e} />

      <div className="flex min-h-0 grow">
        <LibraryPanel editor={e} />

        {e.caughtUp ? (
          <div className="flex min-w-0 grow items-center justify-center bg-panel">
            <p className="m-0 text-[20px] font-semibold tracking-[-0.01em]">You&apos;re all caught up 🎉</p>
          </div>
        ) : (
          <>
            <PhotosColumn editor={e} />
            <FormPanes key={e.session} editor={e} missing={missing} />
          </>
        )}
      </div>

      <LeaveDialog editor={e} />
      <DeleteDraftDialog editor={e} />
    </div>
  );
}

function ActionBar({ editor: e, missing }) {
  const saveLabel = e.savingDraft ? "Saving…" : e.draftId ? "Update Draft" : "Save Draft";
  const canAnalyze = e.aiPhotos.length > 0 && !e.analyzing && !e.loadingDraft;
  const heading = shortItemName(e.listing.title, e.listing.observations) || "Create Listing";

  return (
    <header className="flex h-13 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
      <h1 title={heading} className="m-0 min-w-0 max-w-[320px] shrink truncate text-xl font-semibold tracking-[-0.01em]">
        {heading}
      </h1>
      {e.draftId ? (
        <span className="badge font-mono">{e.listing.sku?.trim() || "No SKU"}</span>
      ) : (
        <span className="badge border-dashed text-ink-3">New listing · not saved</span>
      )}
      {e.saveFlash && (
        <span className="inline-flex items-center gap-1.5 rounded-chip border border-ok-line bg-ok-weak px-2 py-[3px] text-sm font-medium text-ok">
          <CheckIcon className="size-3" />
          Draft saved
        </span>
      )}
      {!e.saveFlash && e.draftError && (
        <span className="inline-flex items-center rounded-chip border border-bad-line bg-bad-weak px-2 py-[3px] text-sm font-medium text-bad">
          Error
        </span>
      )}

      <span aria-hidden="true" className="h-[18px] w-px bg-line" />
      <button type="button" className="btn btn-sm" onClick={e.newListing} disabled={e.busy}>
        <PlusIcon className="size-[13px]" />
        New listing
      </button>

      <div className="flex min-w-0 grow justify-center">
        <TopMessage editor={e} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button type="button" className="btn" disabled={!canAnalyze} onClick={e.analyze}>
          {e.analyzing ? <Spinner className="size-3.5" /> : <AnalyzeIcon className="size-3.5" />}
          {e.analyzing ? "Analyzing…" : "Analyze Photos"}
        </button>
        <button
          type="button"
          className="btn min-w-[104px]"
          disabled={e.savingDraft || e.loadingDraft || e.submitting}
          onClick={e.saveDraft}
        >
          {e.savingDraft && <Spinner className="size-3.5" />}
          {saveLabel}
        </button>
        <ListButton editor={e} missing={missing} className="btn btn-primary btn-lg" />
      </div>
    </header>
  );
}

function ListButton({ editor: e, missing, className }) {
  return (
    <button type="button" className={className} disabled={missing || e.submitting || e.loadingDraft} onClick={e.submit}>
      {e.submitting && <Spinner className="size-3.5" />}
      {e.submitting ? "Listing on eBay…" : listButtonLabel(e.listing)}
    </button>
  );
}

function PhotosColumn({ editor: e }) {
  const zoneRef = useRef(null);
  const googleRef = useRef(null);
  const picking = e.researchMode === "google";

  // Clicking anywhere outside the listing photos (or the Google button)
  // cancels pick-a-photo mode.
  useEffect(() => {
    if (!picking) return;
    function onDown(ev) {
      if (zoneRef.current?.contains(ev.target)) return;
      if (googleRef.current?.contains(ev.target)) return;
      e.cancelGoogleMode();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [picking, e]);

  const hasTitle = !!e.listing.title?.trim();

  return (
    <section
      className={`photos relative flex shrink-0 flex-col gap-3 overflow-y-auto border-r border-line bg-panel p-3 transition-opacity duration-150 ${
        e.loadingDraft ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <div ref={zoneRef} className="pzone flex flex-col">
        <PhotoZone
          title="eBay Listing Photos"
          photos={e.listingPhotos}
          onPhotosChange={e.setListingPhotos}
          pickMode={picking}
          onPickPhoto={e.pickPhotoForGoogle}
          showMain
        />
      </div>
      <PhotoZone
        title="AI Analysis Photos"
        photos={e.aiPhotos}
        onPhotosChange={e.setAiPhotos}
        maxPhotos={8}
      />

      <div>
        <h2 className="lbl mb-1.5">Research</h2>
        <div className="flex gap-1.5">
          <button
            ref={googleRef}
            type="button"
            className={`btn grow ${picking ? "btn-active" : ""}`}
            disabled={e.listingPhotos.length === 0}
            title={e.listingPhotos.length === 0 ? "Add eBay listing photos first" : "Pick a photo to search on Google"}
            onClick={e.toggleGoogleMode}
          >
            Google
          </button>
          <button
            type="button"
            className="btn grow"
            disabled={!hasTitle}
            title={hasTitle ? "Search eBay using the title" : "Run AI analysis first"}
            onClick={e.ebaySearch}
          >
            eBay
          </button>
        </div>
        {picking && <p className="m-0 mt-[7px] text-sm font-medium text-warn">Pick a photo to search on Google.</p>}
      </div>

      <Notes editor={e} />

      {e.draftId ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-base font-medium">
            <input
              type="checkbox"
              className="m-0 size-[15px] cursor-pointer accent-[var(--color-accent)]"
              checked={!!e.listing.skipDraft}
              disabled={e.skipSaving}
              onChange={(ev) => e.toggleSkip(ev.target.checked)}
            />
            Skip Draft
          </label>
          {e.skipSaving && <Spinner className="size-3 text-ink-3" />}
          {e.skipFlash && (
            <span className="inline-flex items-center gap-1 rounded-chip border border-ok-line bg-ok-weak px-1.5 py-0.5 text-xs font-medium text-ok">
              <CheckIcon className="size-2.5" />
              Saved
            </span>
          )}
          <div className="grow" />
          <button type="button" className="btn btn-sm btn-dq" disabled={e.busy} onClick={e.askDelete}>
            <TrashIcon className="size-[13px]" />
            Delete Draft
          </button>
        </div>
      ) : (
        <p className="hint">
          Skip Draft and Delete Draft appear once this is a draft — click Save Draft to add it to the
          queue.
        </p>
      )}
    </section>
  );
}

// Mounted once per session (keyed by it in DesktopCreate).
function FormPanes({ editor: e, missing }) {
  const form = useListingForm(e.listing, e.formSetters(e.session));
  const p = { listing: e.listing, form };

  return (
    <section
      className={`flex min-w-0 grow overflow-hidden bg-panel transition-opacity duration-150 ${
        e.loadingDraft ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <div className="form-pane-a relative flex min-h-0 flex-col gap-3.5 overflow-y-auto px-4 py-3.5">
        <TitleField {...p} />
        <Keywords {...p} />
        <div className="row">
          <CategoryField {...p} />
          <SkuField {...p} />
        </div>
        <div className="border-t border-line pt-3">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="lbl">Item Specifics</h2>
          </div>
          <Specifics {...p} />
        </div>
      </div>

      <div className="form-pane-b relative flex min-h-0 flex-col gap-3.5 overflow-y-auto border-l border-line px-4 py-3.5">
        <ConditionFields {...p} />
        <DescriptionField {...p} />
        <PricingFields {...p} />
        <OptionsGroup {...p} />
        <ShippingFields {...p} />
        <div className="flex items-center gap-3 border-t border-line pt-3">
          <p className="m-0 grow text-sm text-ink-3">
            Photos upload in the order shown; the first is the gallery image.
          </p>
          <ListButton editor={e} missing={missing} className="btn btn-primary btn-lg min-w-[200px]" />
        </div>
      </div>
    </section>
  );
}
