"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export default function PhotoZone({
  title,
  subtitle,
  photos,
  onPhotosChange,
  maxPhotos,
  visionToggle,
  onVisionToggle,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [dragOriginal, setDragOriginal] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const fileInputRef = useRef(null);
  const droppedInSelf = useRef(false);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    function handleKey(e) {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i < photos.length - 1 ? i + 1 : 0));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, photos.length]);

  const handleFiles = useCallback(
    async (files) => {
      if (!files.length) return;

      const remaining = maxPhotos ? maxPhotos - photos.length : files.length;
      if (remaining <= 0) return;

      const filesToAdd = files.slice(0, remaining);
      setUploading(true);

      try {
        const formData = new FormData();
        for (const file of filesToAdd) {
          formData.append("files", file);
        }
        formData.append("folder", "All Photos");

        const res = await fetch("/api/cloudinary/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (data.success) {
          onPhotosChange([...photos, ...data.photos]);
        }
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setUploading(false);
      }
    },
    [photos, onPhotosChange, maxPhotos]
  );

  function handleDragOver(e) {
    e.preventDefault();
    if (dragIndex === null) {
      setIsDragging(true);
    }
    if (e.dataTransfer.types.includes("application/x-library-photo")) {
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);

    if (dragIndex !== null) {
      droppedInSelf.current = true;
      // Commit the reorder on drop
      if (dropTarget !== null && dropTarget !== dragIndex) {
        const updated = [...photos];
        const [moved] = updated.splice(dragIndex, 1);
        updated.splice(dropTarget, 0, moved);
        onPhotosChange(updated);
      }
      setDragIndex(null);
      setDropTarget(null);
      setDragOriginal(null);
      return;
    }

    // Check for library photo drop (from sidebar)
    const libraryData = e.dataTransfer.getData("application/x-library-photo");
    if (libraryData) {
      try {
        const incoming = JSON.parse(libraryData);
        const remaining = maxPhotos ? maxPhotos - photos.length : incoming.length;
        if (remaining > 0) {
          const toAdd = incoming.slice(0, remaining);
          onPhotosChange([...photos, ...toAdd]);
        }
      } catch (err) {
        console.error("Invalid library photo data:", err);
      }
      return;
    }

    // Fall through to file drop (from computer)
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length) {
      handleFiles(files);
    }
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    handleFiles(files);
    e.target.value = "";
  }

  function handleRemove(index) {
    const updated = photos.filter((_, i) => i !== index);
    onPhotosChange(updated);
  }

  function handleReorderStart(e, index) {
    setDragIndex(index);
    setDragOriginal([...photos]);
    droppedInSelf.current = false;
    e.dataTransfer.effectAllowed = "copyMove";
    // Also set library photo data so other zones can accept this photo
    e.dataTransfer.setData(
      "application/x-library-photo",
      JSON.stringify([photos[index]])
    );
  }

  function handleReorderOver(e, index) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setDropTarget(index);
  }

  function handleReorderEnd() {
    // If dropped outside this zone, order stays as-is (no restore needed since we don't reorder during drag)
    setDragIndex(null);
    setDropTarget(null);
    setDragOriginal(null);
    droppedInSelf.current = false;
  }

  const canAdd = !maxPhotos || photos.length < maxPhotos;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-xl border-2 bg-white p-5 transition-colors dark:bg-zinc-900 ${
        isDragging
          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/10"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onVisionToggle !== undefined && (
            <button
              onClick={() => onVisionToggle(!visionToggle)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                visionToggle
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${
                visionToggle ? "bg-green-500" : "bg-zinc-400"
              }`} />
              Vision {visionToggle ? "ON" : "OFF"}
            </button>
          )}
          {maxPhotos && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {photos.length}/{maxPhotos}
            </span>
          )}
        </div>
      </div>

      {photos.length > 0 && (
        <div className="mt-4 max-h-56 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {photos.map((photo, index) => {
              const thumb = photo.secure_url.replace(
                "/upload/",
                "/upload/c_fill,w_200,h_200/"
              );
              return (
                <div
                  key={photo.public_id + "-" + index}
                  draggable
                  onDoubleClick={() => setLightboxIndex(index)}
                  onDragStart={(e) => handleReorderStart(e, index)}
                  onDragOver={(e) => handleReorderOver(e, index)}
                  onDragEnd={handleReorderEnd}
                  className={`group relative h-24 w-24 flex-shrink-0 cursor-grab overflow-hidden rounded-lg border-2 transition-all ${
                    dragIndex === index
                      ? "border-blue-500 opacity-50"
                      : dropTarget === index && dragIndex !== null
                        ? "border-blue-500 ring-2 ring-blue-300"
                        : "border-transparent"
                  }`}
                >
                  <img
                    src={thumb}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                  {index === 0 && onVisionToggle !== undefined && visionToggle && (
                    <span className="absolute top-1 left-1 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      VISION
                    </span>
                  )}
                  {index === 0 && onVisionToggle === undefined && (
                    <span className="absolute top-1 left-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      MAIN
                    </span>
                  )}
                  <button
                    onClick={() => handleRemove(index)}
                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {canAdd && (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`mt-4 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed py-8 transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
              : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          {uploading ? (
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 animate-spin text-zinc-500"
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
              <span className="text-sm text-zinc-500">Uploading...</span>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              <span className="md:hidden">Tap to add photos</span>
              <span className="hidden md:inline">
                Drop photos here or{" "}
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  browse
                </span>
              </span>
            </p>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Left arrow */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
            }}
            className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Image */}
          <img
            src={photos[lightboxIndex].secure_url}
            alt=""
            className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Right arrow */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((i) => (i < photos.length - 1 ? i + 1 : 0));
            }}
            className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Photo counter */}
          <span className="absolute bottom-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
            {lightboxIndex + 1} / {photos.length}
          </span>
        </div>
      )}
    </div>
  );
}
