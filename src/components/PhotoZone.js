"use client";

import { useState, useRef, useCallback } from "react";

export default function PhotoZone({
  title,
  subtitle,
  photos,
  onPhotosChange,
  maxPhotos,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOriginal, setDragOriginal] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const droppedInSelf = useRef(false);

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
      setDragIndex(null);
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

    const updated = [...photos];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    onPhotosChange(updated);
    setDragIndex(index);
  }

  function handleReorderEnd() {
    // If dropped outside this zone, restore original order
    if (!droppedInSelf.current && dragOriginal) {
      onPhotosChange(dragOriginal);
    }
    setDragIndex(null);
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
        {maxPhotos && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {photos.length}/{maxPhotos}
          </span>
        )}
      </div>

      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {photos.map((photo, index) => {
            const thumb = photo.secure_url.replace(
              "/upload/",
              "/upload/c_fill,w_200,h_200/"
            );
            return (
              <div
                key={photo.public_id + "-" + index}
                draggable
                onDragStart={(e) => handleReorderStart(e, index)}
                onDragOver={(e) => handleReorderOver(e, index)}
                onDragEnd={handleReorderEnd}
                className={`group relative cursor-grab overflow-hidden rounded-lg border-2 transition-all ${
                  dragIndex === index
                    ? "border-blue-500 opacity-50"
                    : "border-transparent"
                }`}
              >
                <div className="aspect-square">
                  <img
                    src={thumb}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
                {index === 0 && (
                  <span className="absolute top-1 left-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    MAIN
                  </span>
                )}
                <button
                  onClick={() => handleRemove(index)}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
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
              Drop photos here or{" "}
              <span className="font-medium text-blue-600 dark:text-blue-400">
                browse
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
    </div>
  );
}
