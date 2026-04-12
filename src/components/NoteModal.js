"use client";

import { useState, useEffect } from "react";

export default function NoteModal({ photo, onSave, onClose }) {
  const [note, setNote] = useState("");

  useEffect(() => {
    setNote(photo?.note || "");
  }, [photo]);

  if (!photo) return null;

  async function handleSave() {
    try {
      const res = await fetch("/api/cloudinary/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: photo.public_id, note }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      onSave(photo.public_id, note);
    } catch (err) {
      alert("Failed to save note: " + err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Photo Note
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Add measurements, tag info, or other details.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g., measured 29x30, tag says 32x32"
          rows={3}
          className="mt-4 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}
