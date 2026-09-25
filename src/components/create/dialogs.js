"use client";

import { useState } from "react";
import Dialog from "@/components/ui/Dialog";

// "Save changes?" — shown when switching away from a listing with unsaved
// edits (opening another draft, Next draft, New listing).
export function LeaveDialog({ editor: e, touch = false }) {
  const b = touch ? "btn btn-touch flex-1" : "btn";
  return (
    <Dialog
      open={!!e.leavePrompt}
      onCancel={e.leaveCancel}
      title="Save changes?"
      touch={touch}
      actions={
        <>
          <button type="button" className={b} onClick={e.leaveCancel}>
            Cancel
          </button>
          <button type="button" className={b} onClick={e.leaveDiscard}>
            Discard
          </button>
          <button type="button" className={`${b} btn-primary`} disabled={e.savingDraft} onClick={e.leaveSave}>
            {e.savingDraft ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <p className="hint mt-1.5">
        You have unsaved edits
        {e.listing.sku?.trim() ? (
          <>
            {" "}to <span className="mono text-ink-2">{e.listing.sku.trim()}</span>
          </>
        ) : (
          " to this listing"
        )}
        .
      </p>
    </Dialog>
  );
}

// Delete Draft — never destructive on the first click.
export function DeleteDraftDialog({ editor: e, touch = false }) {
  const b = touch ? "btn btn-touch flex-1" : "btn";
  // Off by default — photos are kept unless you say otherwise.
  const [withPhotos, setWithPhotos] = useState(false);
  const count = (e.listingPhotos?.length || 0) + (e.aiPhotos?.length || 0);
  return (
    <Dialog
      open={e.deletePrompt}
      onCancel={() => {
        setWithPhotos(false);
        e.cancelDelete();
      }}
      title="Delete this draft?"
      touch={touch}
      actions={
        <>
          <button
            type="button"
            className={b}
            onClick={() => {
              setWithPhotos(false);
              e.cancelDelete();
            }}
          >
            No
          </button>
          <button
            type="button"
            className={`${b} btn-danger`}
            disabled={e.deleting}
            onClick={() => {
              e.confirmDelete({ deletePhotos: withPhotos });
              setWithPhotos(false);
            }}
          >
            {e.deleting ? "Deleting…" : "Yes, delete"}
          </button>
        </>
      }
    >
      <p className="hint mt-1.5">
        {e.listing.sku?.trim() && <span className="mono text-ink-2">{e.listing.sku.trim()} · </span>}
        {e.listing.title || "Untitled"}
      </p>
      <label
        className={`mt-2.5 flex cursor-pointer items-center gap-2.5 ${touch ? "min-h-touch text-lg" : "text-md"} font-medium`}
      >
        <input
          type="checkbox"
          className={`${touch ? "size-5" : "size-4"} shrink-0 accent-[var(--color-accent)]`}
          checked={withPhotos}
          onChange={(ev) => setWithPhotos(ev.target.checked)}
        />
        Also delete this draft&apos;s {count || ""} photo{count === 1 ? "" : "s"}
      </label>
      <p className="hint mt-2">
        {withPhotos
          ? "The draft and its photos are deleted for good."
          : "Deletes this draft. Its photos stay in your Photo Library."}{" "}
        This can&apos;t be undone. Nothing on eBay changes.
      </p>
    </Dialog>
  );
}
