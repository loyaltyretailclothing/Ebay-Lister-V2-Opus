"use client";

import { useState, useRef, useCallback } from "react";
import { PlusIcon, XIcon } from "@/components/ui/Icons";
import Lightbox from "@/components/ui/Lightbox";
import { thumbUrl } from "@/lib/resizeImage";

// A photo zone on Create Listing ("eBay Listing Photos" or "AI Analysis
// Photos"). Same behaviour as before: drop photos from the library panel or
// the computer, drag to reorder, remove, double-click to enlarge, and in
// Google pick mode a click sends that photo to Google Lens. The first
// listing photo is the gallery image (MAIN).
export default function PhotoZone({
  title,
  photos,
  onPhotosChange,
  maxPhotos,
  pickMode = false,
  onPickPhoto,
  showMain = false,
  touch = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const fileInputRef = useRef(null);

  // Files from the computer upload straight to the library ("All Photos").
  const handleFiles = useCallback(
    async (files) => {
      if (!files.length) return;
      const remaining = maxPhotos ? maxPhotos - photos.length : files.length;
      if (remaining <= 0) return;
      const filesToAdd = files.slice(0, remaining);
      setUploading(true);
      try {
        const formData = new FormData();
        for (const file of filesToAdd) formData.append("files", file);
        formData.append("folder", "All Photos");
        const res = await fetch("/api/cloudinary/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.success) onPhotosChange([...photos, ...data.photos]);
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
    if (dragIndex === null) setIsDragging(true);
    if (e.dataTransfer.types.includes("application/x-library-photo")) {
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);

    if (dragIndex !== null) {
      if (dropTarget !== null && dropTarget !== dragIndex) {
        const updated = [...photos];
        const [moved] = updated.splice(dragIndex, 1);
        updated.splice(dropTarget, 0, moved);
        onPhotosChange(updated);
      }
      setDragIndex(null);
      setDropTarget(null);
      return;
    }

    const libraryData = e.dataTransfer.getData("application/x-library-photo");
    if (libraryData) {
      try {
        const incoming = JSON.parse(libraryData);
        const remaining = maxPhotos ? maxPhotos - photos.length : incoming.length;
        if (remaining > 0) onPhotosChange([...photos, ...incoming.slice(0, remaining)]);
      } catch (err) {
        console.error("Invalid library photo data:", err);
      }
      return;
    }

    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length) handleFiles(files);
  }

  function handleReorderStart(e, index) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "copyMove";
    // Also set library photo data so the other zone can accept this photo.
    e.dataTransfer.setData("application/x-library-photo", JSON.stringify([photos[index]]));
  }

  const canAdd = !maxPhotos || photos.length < maxPhotos;
  const tileClass = touch
    ? "relative flex aspect-square items-center justify-center overflow-hidden rounded-panel border border-line bg-sunken"
    : "ptile bg-sunken";

  const count = maxPhotos ? (
    touch ? (
      <span className="mono rounded-chip bg-sunken px-[7px] py-0.5 text-sm font-semibold text-ink-3">
        {photos.length} of {maxPhotos}
      </span>
    ) : (
      <span className="badge badge-accent">
        {photos.length}/{maxPhotos}
      </span>
    )
  ) : (
    <span className={`mono text-ink-3 ${touch ? "text-sm" : "text-xs"}`}>{photos.length}</span>
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={handleDrop}
      className={`pzone ${touch ? "" : "rounded-panel border p-[9px]"} ${
        pickMode
          ? "rounded-panel border-warn-line shadow-[0_0_0_2px_var(--color-warn-line)]"
          : isDragging
            ? "rounded-panel border-accent bg-accent-weak"
            : "border-line"
      }`}
    >
      <div className="mb-[7px] flex items-center gap-2">
        <h2 className="lbl">{title}</h2>
        {count}
        <div className="grow" />
        {showMain && photos.length > 1 && !touch && (
          <span className="text-xs text-ink-3">Drag to reorder</span>
        )}
      </div>
      <div className="pgrid grid grid-cols-4 gap-1.5">
        {photos.map((photo, index) => (
          <div
            key={photo.public_id + "-" + index}
            draggable={!pickMode}
            onClick={pickMode ? () => onPickPhoto?.(photo) : undefined}
            onDoubleClick={pickMode ? undefined : () => setLightboxIndex(index)}
            onDragStart={pickMode ? undefined : (e) => handleReorderStart(e, index)}
            onDragOver={
              pickMode
                ? undefined
                : (e) => {
                    e.preventDefault();
                    if (dragIndex !== null && dragIndex !== index) setDropTarget(index);
                  }
            }
            onDragEnd={() => {
              setDragIndex(null);
              setDropTarget(null);
            }}
            className={`${tileClass} ${pickMode ? "cursor-pointer ring-2 ring-inset ring-warn-line" : "cursor-grab"} ${
              dragIndex === index ? "opacity-50" : ""
            } ${dropTarget === index && dragIndex !== null ? "ring-2 ring-inset ring-accent" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbUrl(photo.secure_url, 240)}
              alt=""
              draggable={false}
              className="absolute inset-0 size-full object-cover"
            />
            {showMain && index === 0 && (
              <span className="lbl absolute inset-x-0 bottom-0 bg-accent py-0.5 text-center text-2xs tracking-[0.1em] text-on-accent">
                Main
              </span>
            )}
            {!pickMode && (
              <button
                type="button"
                aria-label="Remove photo"
                onClick={(e) => {
                  e.stopPropagation();
                  onPhotosChange(photos.filter((_, i) => i !== index));
                }}
                className={`absolute right-[3px] top-[3px] flex cursor-pointer items-center justify-center border-0 p-0 text-white ${
                  touch ? "size-[22px] rounded-bar bg-[rgb(16_20_28/.62)]" : "size-4 rounded-[4px] bg-black/60"
                }`}
              >
                <XIcon className={touch ? "size-[11px]" : "size-[9px]"} strokeWidth={3} />
              </button>
            )}
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            className={
              touch
                ? "flex aspect-square cursor-pointer flex-col items-center justify-center gap-0.5 rounded-panel border border-dashed border-line-strong bg-sunken font-sans text-ink-3"
                : "pdrop"
            }
            onClick={() => !uploading && fileInputRef.current?.click()}
            disabled={uploading}
          >
            <PlusIcon className={touch ? "size-[18px]" : "size-4"} />
            <span className={touch ? "text-xs" : "text-2xs"}>
              {uploading ? "Uploading…" : touch ? "Add" : "Drop"}
            </span>
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          handleFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
        className="hidden"
      />
      <Lightbox
        photos={photos}
        index={lightboxIndex}
        onIndex={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
        showNote={false}
      />
    </div>
  );
}
