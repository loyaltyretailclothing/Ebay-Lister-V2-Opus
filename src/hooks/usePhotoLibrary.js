"use client";

import { useState, useEffect, useCallback } from "react";
import { resizeImage } from "@/lib/resizeImage";

// Photo library data + actions, shared by the desktop Create Listing panel
// and the phone Photo Library page. Same endpoints and behaviour as before:
// batches of 500 with "Load older photos", notes on one photo, move between
// folders, delete with a confirm (the caller shows the confirm).
export default function usePhotoLibrary() {
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
        setNextCursor(data.next_cursor || null);
      } else {
        setPhotos([]);
        setNextCursor(null);
        setError(data.error || "Failed to load photos");
      }
    } catch (err) {
      console.error("Failed to fetch photos:", err);
      setPhotos([]);
      setNextCursor(null);
      setError("Could not connect to photo service");
    } finally {
      setLoading(false);
    }
  }, [activeFolder]);

  // Cursor pagination: append the next batch of older photos.
  const fetchMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const res = await fetch(
        `/api/cloudinary/list?folder=${encodeURIComponent(
          activeFolder
        )}&next_cursor=${encodeURIComponent(nextCursor)}`
      );
      const data = await res.json();
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

  return {
    activeFolder,
    setActiveFolder,
    photos,
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
