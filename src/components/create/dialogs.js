"use client";

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
  return (
    <Dialog
      open={e.deletePrompt}
      onCancel={e.cancelDelete}
      title="Delete this draft?"
      touch={touch}
      actions={
        <>
          <button type="button" className={b} onClick={e.cancelDelete}>
            Cancel
          </button>
          <button type="button" className={`${b} btn-danger`} disabled={e.deleting} onClick={e.confirmDelete}>
            {e.deleting ? "Deleting…" : "Delete Draft"}
          </button>
        </>
      }
    >
      <p className="hint mt-1.5">
        {e.listing.sku?.trim() && <span className="mono text-ink-2">{e.listing.sku.trim()} · </span>}
        {e.listing.title || "Untitled"}
      </p>
      <p className="hint mt-2">
        Deletes this draft. Its photos stay in your Photo Library. This can&apos;t be undone.
        Nothing on eBay changes.
      </p>
    </Dialog>
  );
}
