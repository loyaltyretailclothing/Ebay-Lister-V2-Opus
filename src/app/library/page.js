"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FOLDERS } from "@/lib/constants";
import PhotoGrid from "@/components/PhotoGrid";
import UploadZone from "@/components/UploadZone";
import NoteModal from "@/components/NoteModal";
import { usePhotoTransfer } from "@/contexts/PhotoTransferContext";

export default function LibraryPage() {
  const router = useRouter();
  const { addToTransfer } = usePhotoTransfer();
  const [activeFolder, setActiveFolder] = useState("All Photos");
  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [notePhoto, setNotePhoto] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/cloudinary/list?folder=${encodeURIComponent(activeFolder)}`
      );
      const data = await res.json();
      if (data.success) {
        setPhotos(data.photos);
      } else {
        setPhotos([]);
        setError(data.error || "Failed to load photos");
      }
    } catch (err) {
      console.error("Failed to fetch photos:", err);
      setPhotos([]);
      setError("Could not connect to photo service");
    } finally {
      setLoading(false);
    }
  }, [activeFolder]);

  useEffect(() => {
    fetchPhotos();
    setSelected([]);
  }, [fetchPhotos]);

  async function handleUploadComplete(newPhotos) {
    setPhotos((prev) => [...newPhotos, ...prev]);
  }

  async function handleDelete() {
    if (!selected.length) return;
    const count = selected.length;
    if (
      !confirm(
        `Delete ${count} photo${count > 1 ? "s" : ""}? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/cloudinary/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicIds: selected }),
      });
      const data = await res.json();
      if (data.success) {
        setPhotos((prev) =>
          prev.filter((p) => !selected.includes(p.public_id))
        );
        setSelected([]);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(false);
    }
  }

  function handleNoteClick() {
    if (selected.length !== 1) return;
    const photo = photos.find((p) => p.public_id === selected[0]);
    if (photo) setNotePhoto(photo);
  }

  function handleNoteSaved(publicId, note) {
    setPhotos((prev) =>
      prev.map((p) => (p.public_id === publicId ? { ...p, note } : p))
    );
    setNotePhoto(null);
  }

  async function handleMoveToFolder(targetFolder) {
    if (!selected.length) return;

    const movedIds = [];
    for (const publicId of selected) {
      try {
        const res = await fetch("/api/cloudinary/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicId, targetFolder }),
        });
        const data = await res.json();
        if (data.success) {
          movedIds.push(publicId);
        }
      } catch (err) {
        console.error("Move failed:", err);
      }
    }

    setPhotos((prev) => prev.filter((p) => !movedIds.includes(p.public_id)));
    setSelected([]);
  }

  function handleSendToZone(target) {
    const photoMap = Object.fromEntries(
      photos.map((p) => [p.public_id, p])
    );
    const selectedPhotos = selected.map((id) => photoMap[id]).filter(Boolean);
    addToTransfer(selectedPhotos, target);
    router.push("/generate");
  }

  const selectedCount = selected.length;

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col md:h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white px-4 py-3 md:px-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Photo Library
        </h1>

        {/* Folder Tabs */}
        <div className="mt-2 flex items-center gap-1.5">
          {FOLDERS.map((folder) => (
            <button
              key={folder}
              onClick={() => setActiveFolder(folder)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeFolder === folder
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              {folder === "All Photos" ? "All" : folder}
            </button>
          ))}
        </div>

        {/* Action Bar */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {showUpload ? "Hide Upload" : "Upload"}
          </button>
          <button
            onClick={handleDelete}
            disabled={!selected.length || deleting}
            className={`rounded px-2 py-1.5 text-xs transition-colors ${
              selected.length
                ? "border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                : "text-zinc-400 dark:text-zinc-600"
            }`}
          >
            {deleting
              ? "..."
              : `Delete${selected.length ? ` (${selected.length})` : ""}`}
          </button>
          <button
            onClick={handleNoteClick}
            disabled={selected.length !== 1}
            className={`rounded px-2 py-1.5 text-xs transition-colors ${
              selected.length === 1
                ? "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                : "text-zinc-400 dark:text-zinc-600"
            }`}
          >
            Note
          </button>

          {selected.length > 0 && (
            <>
              {FOLDERS.filter((f) => f !== activeFolder).map((folder) => (
                <button
                  key={folder}
                  onClick={() => handleMoveToFolder(folder)}
                  className="rounded px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  &rarr; {folder === "All Photos" ? "All" : folder}
                </button>
              ))}
              <button
                onClick={() => setSelected([])}
                className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                Clear
              </button>
            </>
          )}
        </div>

        {/* Upload Zone */}
        {showUpload && (
          <div className="mt-2">
            <UploadZone
              folder={activeFolder}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {error}
        </div>
      )}

      {/* Photo Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 md:px-6">
        {loading ? (
          <div className="mt-12 flex justify-center">
            <svg
              className="h-8 w-8 animate-spin text-zinc-400"
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
          </div>
        ) : (
          <PhotoGrid
            photos={photos}
            selected={selected}
            onSelect={setSelected}
            onToggle={(id) =>
              setSelected((prev) =>
                prev.includes(id)
                  ? prev.filter((s) => s !== id)
                  : [...prev, id]
              )
            }
            draggable
            tapToToggle
          />
        )}
      </div>

      {/* Send-to-Zone Floating Bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-zinc-200 bg-white px-4 py-3 md:bottom-0 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto flex max-w-lg gap-3">
            <button
              onClick={() => handleSendToZone("listing")}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Send {selectedCount} to eBay Photos
            </button>
            <button
              onClick={() => handleSendToZone("ai")}
              className="flex-1 rounded-lg border border-blue-600 px-4 py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
            >
              Send {selectedCount} to AI Photos
            </button>
          </div>
        </div>
      )}

      {/* Note Modal */}
      <NoteModal
        photo={notePhoto}
        onSave={handleNoteSaved}
        onClose={() => setNotePhoto(null)}
      />
    </div>
  );
}
