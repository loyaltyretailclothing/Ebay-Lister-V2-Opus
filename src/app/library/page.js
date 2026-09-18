"use client";

import { useRef, useState } from "react";
import usePhotoLibrary from "@/hooks/usePhotoLibrary";
import { usePhotoTransfer } from "@/contexts/PhotoTransferContext";
import { FOLDERS } from "@/lib/constants";
import { photoName, thumbUrl } from "@/lib/resizeImage";
import Dialog from "@/components/ui/Dialog";
import Lightbox from "@/components/ui/Lightbox";
import {
  CheckIcon,
  FolderIcon,
  LibraryIcon,
  NoteIcon,
  PlusIcon,
  Spinner,
  UploadIcon,
  XIcon,
} from "@/components/ui/Icons";

const folderLabel = (f) => (f === "All Photos" ? "All" : f);

// Photo Library (phone, and any window smaller than the desktop layout).
// The grid is the page: four across. Tap to select, double-tap to enlarge.
// Selecting raises three short rows above the nav — the count, what to do
// with the photos, and (nearest the thumb) where to send them.
export default function LibraryPage() {
  const lib = usePhotoLibrary();
  const { addToTransfer } = usePhotoTransfer();
  const fileRef = useRef(null);
  const lastTap = useRef(null); // { id, at } of the last tile tap
  const [lightbox, setLightbox] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [noteError, setNoteError] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  // Send to: { target, progress } while filling; { target, done: true } for
  // the ~1s the check holds.
  const [send, setSend] = useState(null);

  const n = lib.selected.length;
  const uploading = lib.upload && lib.upload.total !== undefined;

  // A tap selects straight away. A second tap on the SAME photo within
  // 300ms is a double-tap: it undoes that selection and opens the photo.
  // Quick taps on different photos just select them.
  function onTileTap(photo, index) {
    const now = Date.now();
    const last = lastTap.current;
    if (last && last.id === photo.public_id && now - last.at < 300) {
      lastTap.current = null;
      lib.toggleSelect(photo.public_id); // undo the first tap's select
      setLightbox(index);
      return;
    }
    lastTap.current = { id: photo.public_id, at: now };
    lib.toggleSelect(photo.public_id);
  }

  function sendTo(target) {
    if (send || n === 0) return;
    addToTransfer(lib.selectedPhotos(), target);
    let progress = 0;
    setSend({ target, progress });
    const interval = setInterval(() => {
      progress += 5;
      if (progress >= 100) {
        clearInterval(interval);
        // The selection clears the moment the check appears.
        lib.clearSelection();
        setSend({ target, done: true });
        setTimeout(() => setSend(null), 1000);
      } else {
        setSend({ target, progress });
      }
    }, 50);
  }

  function openNote() {
    if (n !== 1) return;
    const photo = lib.photos.find((p) => p.public_id === lib.selected[0]);
    if (!photo) return;
    setNoteFor(photo);
    setNoteText(photo.note || "");
    setNoteError("");
  }

  async function saveNote() {
    try {
      await lib.saveNote(noteFor.public_id, noteText);
      setNoteFor(null);
    } catch (err) {
      setNoteError(err.message);
    }
  }

  const sendButton = (target, label) => {
    const active = send?.target === target;
    const done = active && send.done;
    return (
      <button
        type="button"
        className={`btn send h-11 ${done ? "btn-primary" : active ? "send-on" : ""}`}
        disabled={!!send && !active}
        onClick={() => sendTo(target)}
      >
        {active && !done && <span className="send-fill" style={{ width: `${send.progress}%` }} />}
        <span className="send-txt">
          {done && <CheckIcon className="size-[15px]" strokeWidth={2.8} />}
          {label}
        </span>
      </button>
    );
  };

  const showBar = n > 0 || !!send;

  return (
    <div className="mx-auto flex h-full w-full max-w-[640px] flex-col bg-panel">
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line pl-3.5 pr-2">
        <h1 className="m-0 text-3xl font-semibold tracking-[-0.01em]">Photo Library</h1>
        <div className="grow" />
        <button
          type="button"
          className="btn btn-ghost btn-touch px-2.5 text-accent"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <UploadIcon className="size-[17px]" />
          Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            lib.uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </header>

      <div className="shrink-0 px-2 pb-1.5 pt-2">
        <div className="seg seg-touch">
          {FOLDERS.map((f) => (
            <button key={f} type="button" aria-pressed={lib.activeFolder === f} onClick={() => lib.setActiveFolder(f)}>
              {folderLabel(f)}
            </button>
          ))}
        </div>
      </div>

      {lib.upload && (
        <div className="flex shrink-0 flex-col gap-1 px-3 pb-2">
          {uploading ? (
            <>
              <div className="flex items-center gap-2">
                <Spinner className="size-3.5 text-accent" />
                <span className="text-base font-medium text-ink-2">
                  Uploading {lib.upload.done}/{lib.upload.total}…
                </span>
              </div>
              <span className="prog">
                <span style={{ width: `${(lib.upload.done / lib.upload.total) * 100}%` }} />
              </span>
            </>
          ) : (
            <span className={`text-base font-medium ${lib.upload.failed ? "text-bad" : "text-ok"}`}>
              {lib.upload.message}
            </span>
          )}
        </div>
      )}

      {lib.error && <p className="m-0 shrink-0 px-3 pb-2 text-md font-medium text-bad">{lib.error}</p>}

      {lib.loading ? (
        <div className="flex grow items-center justify-center">
          <Spinner className="size-6 text-ink-3" />
        </div>
      ) : lib.photos.length === 0 ? (
        <div className="flex min-h-0 grow flex-col items-center justify-center gap-3.5 p-6">
          <span className="flex size-[60px] items-center justify-center rounded-full border border-line bg-sunken text-ink-3">
            <LibraryIcon className="size-7" strokeWidth={1.5} />
          </span>
          <p className="m-0 text-3xl font-semibold">No photos yet</p>
          <p className="hint max-w-[250px] text-center">Shoot with the camera, or upload from this phone.</p>
          <button type="button" className="btn btn-primary btn-touch" onClick={() => fileRef.current?.click()}>
            Upload photos
          </button>
        </div>
      ) : (
        <div className="min-h-0 grow overflow-y-auto px-2 pb-[58px]">
          <div className="pgrid4">
            <button
              type="button"
              className="drop"
              aria-label="Add photos"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                lib.uploadFiles(e.dataTransfer.files);
              }}
            >
              <PlusIcon className="size-[17px]" strokeWidth={1.9} />
              <span className="text-2xs">Add</span>
            </button>
            {lib.photos.map((photo, i) => {
              const on = lib.selected.includes(photo.public_id);
              return (
                <button
                  key={photo.public_id}
                  type="button"
                  className={`tile ${on ? "tile-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => onTileTap(photo, i)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl(photo.secure_url, 200)}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover"
                  />
                  {on && (
                    <span className="tick tick-on">
                      <CheckIcon className="size-[11px]" strokeWidth={3.4} />
                    </span>
                  )}
                  {photo.note && (
                    <span className="notebadge" aria-label="Has a note">
                      <NoteIcon className="size-2.5" strokeWidth={2.4} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {lib.nextCursor && (
            <button type="button" className="btn btn-touch mt-2.5 w-full" disabled={lib.loadingMore} onClick={lib.fetchMore}>
              {lib.loadingMore ? "Loading…" : "Load older photos"}
            </button>
          )}
          <p className="hint mt-2.5">Tap to select. Double-tap a photo to open it full screen.</p>
        </div>
      )}

      {showBar && (
        <div className="shrink-0 border-t border-line bg-panel-2">
          {n > 0 && (
            <>
              <div className="flex items-center gap-2 px-3 pt-0.5">
                <span className="text-md font-semibold text-accent">{n} selected</span>
                <div className="grow" />
                <button type="button" className="btn btn-ghost btn-touch px-2 text-accent" onClick={lib.clearSelection}>
                  Clear
                </button>
              </div>
              <div className="flex gap-1.5 px-3 pt-1">
                <button type="button" className="btn btn-danger h-10 px-2.5" disabled={lib.deleting} onClick={() => setAskDelete(true)}>
                  Delete ({n})
                </button>
                {/* Note is for exactly one photo — greyed at any other count. */}
                <button
                  type="button"
                  className={`btn h-10 px-2.5 ${n === 1 ? "" : "btn-off"}`}
                  disabled={n !== 1}
                  onClick={openNote}
                >
                  Note
                </button>
                <div className="grow" />
                {FOLDERS.filter((f) => f !== lib.activeFolder).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="btn h-10 px-[9px]"
                    aria-label={`Move to ${folderLabel(f)}`}
                    onClick={() => lib.moveSelected(f)}
                  >
                    <FolderIcon className="size-3.5" />
                    {folderLabel(f)}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="flex items-center gap-2 px-3 pb-2.5 pt-2">
            <span className="lbl shrink-0">Send to</span>
            {sendButton("listing", "eBay Listing")}
            {sendButton("ai", "AI Analysis")}
          </div>
        </div>
      )}

      <Lightbox photos={lib.photos} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />

      <Dialog
        open={askDelete}
        onCancel={() => setAskDelete(false)}
        title={`Delete ${n} photo${n === 1 ? "" : "s"}?`}
        touch
        actions={
          <>
            <button type="button" className="btn btn-touch flex-1" onClick={() => setAskDelete(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger btn-touch flex-1 font-semibold"
              onClick={async () => {
                setAskDelete(false);
                await lib.deleteSelected();
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="hint mt-[7px]">This cannot be undone.</p>
      </Dialog>

      {noteFor && (
        <div
          className="scrim"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNoteFor(null);
          }}
        >
          <div className="dialog" role="dialog" aria-modal="true">
            <div className="mb-2.5 flex items-center gap-2">
              <p className="m-0 min-w-0 truncate text-2xl font-semibold">Note on {photoName(noteFor)}</p>
              <div className="grow" />
              <button type="button" className="roundbtn roundbtn-no" aria-label="Cancel" onClick={() => setNoteFor(null)}>
                <XIcon className="size-[19px]" />
              </button>
              <button type="button" className="roundbtn roundbtn-yes" aria-label="Save" onClick={saveNote}>
                <CheckIcon className="size-[19px]" strokeWidth={2.8} />
              </button>
            </div>
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="textarea-touch"
              placeholder="Measurements, tag wording, flaws"
            />
            <p className="hint mt-2">
              A reminder on this photo. Shows as a badge and in the enlarged view. Not sent to eBay
              or the AI.
            </p>
            {noteError && <p className="mt-1.5 text-md font-medium text-bad">Failed to save note: {noteError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
