"use client";

import { useState, useRef, useCallback } from "react";

export default function UploadZone({ folder, onUploadComplete }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const fileInputRef = useRef(null);

  const handleFiles = useCallback(
    async (files) => {
      if (!files.length) return;

      setUploading(true);
      const total = files.length;
      const BATCH_SIZE = 5;
      const allPhotos = [];
      let failed = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        setProgress(`Uploading ${Math.min(i + BATCH_SIZE, total)}/${total}...`);

        const formData = new FormData();
        for (const file of batch) {
          formData.append("files", file);
        }
        formData.append("folder", folder);

        try {
          const res = await fetch("/api/cloudinary/upload", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (data.success) {
            allPhotos.push(...data.photos);
          } else {
            failed += batch.length;
          }
        } catch {
          failed += batch.length;
        }
      }

      if (allPhotos.length > 0) {
        onUploadComplete?.(allPhotos);
      }

      const msg = failed > 0
        ? `Uploaded ${allPhotos.length}/${total} (${failed} failed)`
        : `Uploaded ${allPhotos.length} photo${allPhotos.length > 1 ? "s" : ""}`;
      setProgress(msg);
      setUploading(false);
      setTimeout(() => setProgress(""), 5000);
    },
    [folder, onUploadComplete]
  );

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    handleFiles(files);
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    handleFiles(files);
    e.target.value = "";
  }

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 transition-colors ${
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
            <span className="text-sm text-zinc-500">{progress}</span>
          </div>
        ) : (
          <>
            <svg
              className="h-8 w-8 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Drag and drop photos here, or{" "}
              <span className="font-medium text-blue-600 dark:text-blue-400">
                browse
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              JPG, PNG, WebP — auto-resized to 1600x1600
            </p>
          </>
        )}
      </div>
      {progress && !uploading && (
        <p className="mt-2 text-center text-sm text-green-600 dark:text-green-400">
          {progress}
        </p>
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
