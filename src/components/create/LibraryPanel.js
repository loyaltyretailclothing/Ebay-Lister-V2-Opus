"use client";

import { useRef, useState } from "react";
import usePhotoLibrary from "@/hooks/usePhotoLibrary";
import { FOLDERS } from "@/lib/constants";
import { photoName, thumbUrl } from "@/lib/resizeImage";
import Dialog from "@/components/ui/Dialog";
import Lightbox from "@/components/ui/Lightbox";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DraftsIcon,
  LibraryIcon,
  NoteIcon,
  RefreshIcon,
  Spinner,
  UploadIcon,
} from "@/components/ui/Icons";

const PANEL_KEY = "lister.libPanel"; // "open" | "closed" — the user's choice
const MODE_KEY = "lister.libMode"; // "photos" | "drafts"

function readPref(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

const folderLabel = (f) => (f === "All Photos" ? "All" : f);

// Desktop Create Listing, left panel: the photo library and the draft queue
// in one panel with a Photos | Drafts switch. Collapses to a 40px spine;
// below 1500px of app width it collapses by itself until the user touches
// the control (`lib-auto`), after which their choice wins and is remembered.
export default function LibraryPanel({ editor }) {
  // Only ever rendered in the browser (Create Listing picks its layout
  // after load), so the saved choices can be read straight away.
  const [state, setState] = useState(() => {
    const saved = readPref(PANEL_KEY);
    return saved === "open" || saved === "closed" ? saved : "auto"; // auto | open | closed
  });
  const [mode, setMode] = useState(() => (readPref(MODE_KEY) === "drafts" ? "drafts" : "photos"));

  const setPanel = (s) => {
    setState(s);
    writePref(PANEL_KEY, s);
  };
  const switchMode = (m) => {
    setMode(m);
    writePref(MODE_KEY, m);
  };

  const cls =
    state === "auto" ? "lib-auto" : state === "closed" ? "lib-closed" : "";

  return (
    <aside className={`lib ${cls} flex min-h-0 shrink-0 flex-col border-r border-line bg-panel`}>
      {/* 40px spine: the mode stays readable and changeable when collapsed. */}
      <div className="lib-spine flex-col items-center gap-2.5 py-2.5">
        <button
          type="button"
          aria-label="Expand panel"
          onClick={() => setPanel("open")}
          className="flex size-6 cursor-pointer items-center justify-center rounded-chip border-0 bg-transparent text-ink-3 hover:bg-panel-2"
        >
          <ChevronRightIcon className="size-[15px]" />
        </button>
        <button
          type="button"
          className={`modebtn ${mode === "photos" ? "modebtn-on" : ""}`}
          aria-label="Photos"
          aria-pressed={mode === "photos"}
          onClick={() => switchMode("photos")}
        >
          <LibraryIcon className="size-[15px]" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className={`modebtn ${mode === "drafts" ? "modebtn-on" : ""}`}
          aria-label="Drafts"
          aria-pressed={mode === "drafts"}
          onClick={() => switchMode("drafts")}
        >
          <DraftsIcon className="size-[15px]" strokeWidth={1.8} />
        </button>
        <span className="lbl [writing-mode:vertical-rl] tracking-[0.14em]">
          {mode === "drafts" ? `Drafts · ${editor.drafts.length}` : "Photos"}
        </span>
      </div>

      <div className="lib-body flex min-h-0 grow flex-col">
        <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">
          <div className="seg grow">
            <button type="button" aria-pressed={mode === "photos"} onClick={() => switchMode("photos")}>
              Photos
            </button>
            <button type="button" aria-pressed={mode === "drafts"} onClick={() => switchMode("drafts")}>
              Drafts
            </button>
          </div>
          <button
            type="button"
            aria-label="Collapse panel"
            onClick={() => setPanel("closed")}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-chip border-0 bg-transparent text-ink-3 hover:bg-panel-2"
          >
            <ChevronLeftIcon className="size-[15px]" />
          </button>
        </div>
        {/* Both bodies stay mounted so each keeps its scroll position. */}
        <div className={mode === "photos" ? "flex min-h-0 grow flex-col" : "hidden"}>
          <PhotosBody />
        </div>
        <div className={mode === "drafts" ? "flex min-h-0 grow flex-col" : "hidden"}>
          <DraftsBody editor={editor} />
        </div>
      </div>
    </aside>
  );
}

function PhotosBody() {
  const lib = usePhotoLibrary();
  const [lightbox, setLightbox] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [noteError, setNoteError] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  const fileRef = useRef(null);

  const n = lib.selected.length;

  function onTileClick(e, id) {
    if (e.ctrlKey || e.metaKey) {
      lib.toggleSelect(id);
    } else if (e.shiftKey && n > 0) {
      const ids = lib.photos.map((p) => p.public_id);
      const a = ids.indexOf(lib.selected[n - 1]);
      const b = ids.indexOf(id);
      const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
      lib.setSelected([...new Set([...lib.selected, ...range])]);
    } else {
      lib.setSelected(lib.selected.includes(id) && n === 1 ? [] : [id]);
    }
  }

  function onDragStart(e, photo) {
    const dragPhotos =
      n > 0 && lib.selected.includes(photo.public_id) ? lib.selectedPhotos() : [photo];
    e.dataTransfer.setData("application/x-library-photo", JSON.stringify(dragPhotos));
    e.dataTransfer.effectAllowed = "copy";
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

  return (
    <>
      <div className="px-3 pb-2">
        <div className="seg">
          {FOLDERS.map((f) => (
            <button key={f} type="button" aria-pressed={lib.activeFolder === f} onClick={() => lib.setActiveFolder(f)}>
              {folderLabel(f)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5 px-3 pb-2">
        <button
          type="button"
          className="btn btn-primary grow"
          disabled={!!lib.upload && lib.upload.total !== undefined}
          onClick={() => fileRef.current?.click()}
        >
          <UploadIcon className="size-3.5" />
          Upload Photos
        </button>
        <button type="button" className={`btn ${n === 1 ? "" : "btn-off"}`} disabled={n !== 1} onClick={openNote}>
          Note
        </button>
        <button type="button" className="btn btn-ghost" disabled={n === 0} onClick={lib.clearSelection}>
          Clear
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
      </div>

      {lib.upload && (
        <div className="mx-3 mb-2 flex flex-col gap-1">
          {lib.upload.total !== undefined ? (
            <>
              <span className="flex items-center gap-2 text-sm font-medium text-ink-2">
                <Spinner className="size-3 text-accent" />
                Uploading {lib.upload.done}/{lib.upload.total}…
              </span>
              <span className="prog">
                <span style={{ width: `${(lib.upload.done / lib.upload.total) * 100}%` }} />
              </span>
            </>
          ) : (
            <span className={`text-sm font-medium ${lib.upload.failed ? "text-bad" : "text-ok"}`}>
              {lib.upload.message}
            </span>
          )}
        </div>
      )}

      {n > 0 && (
        <div className="mx-3 mb-2 flex flex-wrap items-center gap-1.5 rounded-bar border border-accent-line bg-accent-weak px-2 py-[7px]">
          <span className="mono text-sm font-semibold text-accent">{n} selected</span>
          <div className="grow" />
          <button type="button" className="btn btn-sm btn-danger" disabled={lib.deleting} onClick={() => setAskDelete(true)}>
            Delete ({n})
          </button>
          <span className="text-xs text-ink-3">Move to</span>
          {FOLDERS.filter((f) => f !== lib.activeFolder).map((f) => (
            <button key={f} type="button" className="btn btn-sm" onClick={() => lib.moveSelected(f)}>
              {folderLabel(f)}
            </button>
          ))}
        </div>
      )}

      {lib.error && <p className="mx-3 mb-2 text-sm font-medium text-bad">{lib.error}</p>}

      <div className="min-h-0 grow overflow-y-auto px-3">
        {lib.loading ? (
          <p className="hint flex items-center gap-2 py-6">
            <Spinner className="size-3.5" /> Loading photos…
          </p>
        ) : lib.photos.length === 0 ? (
          <p className="hint py-6 text-center">No photos yet. Upload some to get started.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {lib.photos.map((photo, i) => {
              const on = lib.selected.includes(photo.public_id);
              return (
                <div
                  key={photo.public_id}
                  draggable
                  onDragStart={(e) => onDragStart(e, photo)}
                  onClick={(e) => onTileClick(e, photo.public_id)}
                  onDoubleClick={() => setLightbox(i)}
                  className={`relative aspect-square cursor-pointer overflow-hidden rounded-field border border-line bg-sunken ${
                    on ? "ring-2 ring-inset ring-accent" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl(photo.secure_url, 200)}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="absolute inset-0 size-full object-cover"
                  />
                  {on && (
                    <span className="absolute left-1 top-1 flex size-[15px] items-center justify-center rounded-[4px] bg-accent text-on-accent">
                      <CheckIcon className="size-2.5" strokeWidth={3.2} />
                    </span>
                  )}
                  {photo.note && (
                    <span
                      aria-label="Has note"
                      className="absolute right-1 top-1 flex size-[15px] items-center justify-center rounded-[4px] border border-warn-line bg-warn-weak text-warn"
                    >
                      <NoteIcon className="size-[9px]" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {lib.nextCursor && !lib.loading && (
          <button type="button" className="btn btn-ghost mb-1.5 mt-2 w-full" disabled={lib.loadingMore} onClick={lib.fetchMore}>
            {lib.loadingMore ? "Loading…" : "Load older photos"}
          </button>
        )}
      </div>

      <p className="m-0 border-t border-line px-3 py-2.5 text-sm text-ink-3">
        Double-click a photo to enlarge. Drag photos onto a zone to the right.
      </p>

      <Lightbox photos={lib.photos} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />

      <Dialog
        open={askDelete}
        onCancel={() => setAskDelete(false)}
        title={`Delete ${n} photo${n === 1 ? "" : "s"}?`}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setAskDelete(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
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
        <p className="hint mt-1.5">This cannot be undone.</p>
      </Dialog>

      <Dialog
        open={!!noteFor}
        onCancel={() => setNoteFor(null)}
        title={noteFor ? `Note on ${photoName(noteFor)}` : ""}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setNoteFor(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={saveNote}>
              Save Note
            </button>
          </>
        }
      >
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={4}
          placeholder="Measurements, tag wording, flaws"
          className="textarea mt-2.5"
        />
        <p className="hint mt-2">
          A reminder on this photo. Shows as a badge and in the enlarged view. Not sent to eBay or
          the AI.
        </p>
        {noteError && <p className="mt-1.5 text-sm font-medium text-bad">Failed to save note: {noteError}</p>}
      </Dialog>
    </>
  );
}

function DraftsBody({ editor }) {
  const e = editor;
  return (
    <>
      <div className="flex items-center gap-2 px-3 pb-2">
        <span className="lbl text-xs">
          {e.drafts.length} draft{e.drafts.length === 1 ? "" : "s"}
        </span>
        <div className="grow" />
        <button type="button" className="btn btn-sm btn-ghost" disabled={e.draftsLoading} onClick={e.refreshDrafts}>
          {e.draftsLoading ? <Spinner className="size-[13px]" /> : <RefreshIcon className="size-[13px]" />}
          Refresh
        </button>
      </div>

      {e.draftsError && <p className="mx-3 mb-2 text-sm font-medium text-bad">{e.draftsError}</p>}

      <div className="flex min-h-0 grow flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {e.draftsLoaded && e.drafts.length === 0 && (
          <p className="hint px-2 py-6 text-center">No drafts.</p>
        )}
        {e.drafts.map((d) => {
          const processing = d.status === "processing";
          const isError = d.status === "error";
          const current = d.id === e.draftId;
          const inner = (
            <>
              <span className="dthumb">
                {d.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbUrl(d.thumbnailUrl, 80)} alt="" className="size-full object-cover" />
                )}
              </span>
              <span className="min-w-0 grow">
                <span className="dtitle">{d.title || "Untitled"}</span>
                {processing ? (
                  <span className="dstat text-ink-3">
                    <Spinner className="size-[11px]" />
                    Processing
                  </span>
                ) : isError ? (
                  <span className="dstat text-bad">
                    <span className="dot bg-bad" />
                    Error
                    {d.skipped && <span className="skipped">Skipped</span>}
                  </span>
                ) : (
                  <span className="dstat text-ok">
                    <span className="dot bg-ok" />
                    Ready
                    {d.skipped && <span className="skipped">Skipped</span>}
                  </span>
                )}
              </span>
            </>
          );
          // Processing rows have no handler at all.
          return processing ? (
            <div key={d.id} className="drow drow-off">
              {inner}
            </div>
          ) : (
            <button
              key={d.id}
              type="button"
              className={`drow ${current ? "drow-on" : ""}`}
              aria-current={current ? "true" : undefined}
              title={e.busy ? "Wait for the current action to finish" : undefined}
              onClick={() => e.openDraft(d.id)}
            >
              {inner}
            </button>
          );
        })}
      </div>

      <p className="m-0 border-t border-line px-3 py-2.5 text-sm text-ink-3">
        Oldest first, so Next draft is the next row down. Refreshes on save, publish, Next draft
        and Refresh — never on a timer.
      </p>
    </>
  );
}
