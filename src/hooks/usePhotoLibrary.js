"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { resizeImage } from "@/lib/resizeImage";

// Photo library data + actions, shared by the desktop Create Listing panel
// and the phone Photo Library page. Same endpoints and behaviour as before:
// batches of 500 with "Load older photos", notes on one photo, move between
// folders, delete with a confirm (the caller shows the confirm).
// `heldFor` — the id of the held draft being edited. Held drafts keep their
// photos out of the Photo Library; opening one turns the library into just
// that draft's photos. Everything else behaves exactly as before.
export default function usePhotoLibrary({ heldFor = "" } = {}) {
  const [activeFolder, setActiveFolder] = useState("All Photos");
  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  // Upload progress: { done, total } while running; { message } briefly after.
  const [upload, setUpload] = useState(null);

  // Which fetch is the current one. A big library takes seconds to come back,
  // so opening a held draft (which asks for that draft's photos instead) would
  // otherwise be overwritten by the library answer landing later. Only the
  // newest request is allowed to set the photos.
  const request = useRef(0);

  const fetchPhotos = useCallback(async () => {
    const mine = ++request.current;
    setLoading(true);
    setError("");
    try {
      const libraryUrl = `/api/cloudinary/list?folder=${encodeURIComponent(activeFolder)}`;
      const res = await fetch(
        heldFor ? `/api/cloudinary/list?heldFor=${encodeURIComponent(heldFor)}` : libraryUrl
      );
      let data = await res.json();
      // A draft held before its photos were marked has none to find — show
      // the ordinary library rather than an empty panel.
      if (heldFor && data.success && (data.photos || []).length === 0) {
        data = await fetch(libraryUrl).then((r) => r.json());
      }
      if (mine !== request.current) return;
      if (data.success) {
        setPhotos(data.photos);
        setNextCursor(data.next_cursor || null);
      } else {
        setPhotos([]);
        setNextCursor(null);
        setError(data.error || "Failed to load photos");
      }
    } catch (err) {
      console.error("Failed to fetch photos:", err);
      if (mine !== request.current) return;
      setPhotos([]);
      setNextCursor(null);
      setError("Could not connect to photo service");
    } finally {
      if (mine === request.current) setLoading(false);
    }
  }, [activeFolder, heldFor]);

  // Cursor pagination: append the next batch of older photos.
  const fetchMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const mine = request.current;
    setLoadingMore(true);
    setError("");
    try {
      const res = await fetch(
        `/api/cloudinary/list?folder=${encodeURIComponent(
          activeFolder
        )}&next_cursor=${encodeURIComponent(nextCursor)}`
      );
      const data = await res.json();
      // The view changed while this batch was loading — drop it.
      if (mine !== request.current) return;
      if (data.success) {
        setPhotos((prev) => [...prev, ...data.photos]);
        setNextCursor(data.next_cursor || null);
      } else {
        setError(data.error || "Failed to load more photos");
      }
    } catch (err) {
      console.error("Failed to fetch more photos:", err);
      setError("Could not connect to photo service");
    } finally {
      setLoadingMore(false);
    }
  }, [activeFolder, nextCursor, loadingMore]);

  useEffect(() => {
    fetchPhotos();
    setSelected([]);
  }, [fetchPhotos]);

  const toggleSelect = useCallback((id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const clearSelection = useCallback(() => setSelected([]), []);

  // Upload files to the current folder, 5 at a time, resized first.
  const uploadFiles = useCallback(
    async (files) => {
      const list = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
      if (!list.length) return;
      const total = list.length;
      const BATCH_SIZE = 5;
      const added = [];
      let failed = 0;
      setUpload({ done: 0, total });

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = list.slice(i, i + BATCH_SIZE);
        setUpload({ done: Math.min(i + BATCH_SIZE, total), total });
        const resized = await Promise.all(batch.map((f) => resizeImage(f)));
        const formData = new FormData();
        for (const file of resized) formData.append("files", file);
        formData.append("folder", activeFolder);
        try {
          const res = await fetch("/api/cloudinary/upload", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (data.success) added.push(...data.photos);
          else failed += batch.length;
        } catch {
          failed += batch.length;
        }
      }

      if (added.length) setPhotos((prev) => [...added, ...prev]);
      setUpload({
        message:
          failed > 0
            ? `Uploaded ${added.length}/${total} (${failed} failed)`
            : `Uploaded ${added.length} photo${added.length === 1 ? "" : "s"}`,
        failed: failed > 0,
      });
      setTimeout(() => setUpload(null), 5000);
    },
    [activeFolder]
  );

  // Delete the selected photos. The caller has already confirmed.
  const deleteSelected = useCallback(async () => {
    if (!selected.length) return false;
    setDeleting(true);
    try {
      const res = await fetch("/api/cloudinary/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicIds: selected }),
      });
      const data = await res.json();
      if (data.success) {
        setPhotos((prev) => prev.filter((p) => !selected.includes(p.public_id)));
        setSelected([]);
        return true;
      }
      setError(data.error || "Delete failed");
      return false;
    } catch (err) {
      console.error("Delete failed:", err);
      setError("Delete failed");
      return false;
    } finally {
      setDeleting(false);
    }
  }, [selected]);

  // Save a note on one photo.
  const saveNote = useCallback(async (publicId, note) => {
    const res = await fetch("/api/cloudinary/note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId, note }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to save note");
    setPhotos((prev) =>
      prev.map((p) => (p.public_id === publicId ? { ...p, note } : p))
    );
  }, []);

  // Move the selected photos to another folder.
  const moveSelected = useCallback(
    async (targetFolder) => {
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
          if (data.success) movedIds.push(publicId);
        } catch (err) {
          console.error("Move failed:", err);
        }
      }
      setPhotos((prev) => prev.filter((p) => !movedIds.includes(p.public_id)));
      setSelected([]);
    },
    [selected]
  );

  // Selected photos in click order (used for sending and dragging).
  const selectedPhotos = useCallback(() => {
    const map = Object.fromEntries(photos.map((p) => [p.public_id, p]));
    return selected.map((id) => map[id]).filter(Boolean);
  }, [photos, selected]);

  // With heldFor set, the fetch above already asked for exactly that
  // draft's photos, so nothing to filter. Otherwise held photos are hidden
  // from the library. A draft held before the marking existed comes back
  // empty — fall back to the ordinary library rather than an empty panel
  // (re-holding it marks its photos).
  const heldActive = !!heldFor && photos.some((p) => p.heldDraft === heldFor);
  const visiblePhotos = heldActive ? photos : photos.filter((p) => !p.heldDraft);

  return {
    activeFolder,
    setActiveFolder,
    photos: visiblePhotos,
    allPhotos: photos,
    heldActive,
    selected,
    setSelected,
    toggleSelect,
    clearSelection,
    selectedPhotos,
    loading,
    loadingMore,
    nextCursor,
    fetchMore,
    deleting,
    error,
    upload,
    uploadFiles,
    deleteSelected,
    saveNote,
    moveSelected,
  };
}
