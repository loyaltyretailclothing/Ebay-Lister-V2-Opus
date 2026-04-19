"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Camera from "@/components/Camera";

// /camera
//
// Two phases:
//   1. Camera — live viewfinder. User snaps any number of photos, then taps Done.
//   2. Review — grid of captured photos. User taps photos to select a subset
//      for AI analysis (typically 2-3 strong front/tag/detail shots), can
//      delete any photo they don't want, and taps Create Draft to kick off
//      the background pipeline.
//
// On Create Draft:
//   - Upload every photo to Cloudinary under the "All Photos" library folder.
//   - Fire-and-forget POST /api/drafts/process with the full listingPhotos
//     array + aiPhotoIndices subset.
//   - Navigate to /drafts so the user can see the in-flight row and keep
//     shooting more items from a fresh /camera session.
export default function CameraPage() {
  const router = useRouter();
  const [phase, setPhase] = useState("capture"); // "capture" | "review"
  const [photos, setPhotos] = useState([]); // [{ blob, url }]
  const [aiSelected, setAiSelected] = useState(new Set()); // indices selected for AI
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleCameraDone(captured) {
    setPhotos(captured);
    // Default: first 3 photos are the AI analysis subset (user can adjust).
    const defaultAi = new Set(captured.slice(0, 3).map((_, i) => i));
    setAiSelected(defaultAi);
    setPhase("review");
  }

  function handleCameraCancel() {
    router.push("/drafts");
  }

  function toggleAi(index) {
    setAiSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function removePhoto(index) {
    setPhotos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return next;
    });
    // Rebuild the AI selection set with shifted indices.
    setAiSelected((prev) => {
      const next = new Set();
      for (const i of prev) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
        // i === index is dropped
      }
      return next;
    });
  }

  function backToCamera() {
    // Discard review state and go back to shoot more (existing photos lost).
    photos.forEach((p) => p.url && URL.revokeObjectURL(p.url));
    setPhotos([]);
    setAiSelected(new Set());
    setPhase("capture");
  }

  async function handleCreateDraft() {
    if (photos.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      // 1. Upload every photo to Cloudinary (All Photos library folder).
      const formData = new FormData();
      photos.forEach((p, i) => {
        const file = new File([p.blob], `camera-${Date.now()}-${i}.jpg`, {
          type: "image/jpeg",
        });
        formData.append("files", file);
      });
      formData.append("folder", "All Photos");

      const uploadRes = await fetch("/api/cloudinary/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.error || "Upload failed");
      }

      const listingPhotos = uploadData.photos;
      const aiPhotoIndices = [...aiSelected].sort((a, b) => a - b);

      // 2. Fire-and-forget the background pipeline. We don't await the
      //    response — the draft row appears as "processing" immediately and
      //    the Drafts page polls for updates.
      fetch("/api/drafts/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingPhotos, aiPhotoIndices }),
      }).catch((err) => {
        // Logged only — the server still writes an error draft on its side.
        console.error("Background process kickoff failed:", err);
      });

      // 3. Release blob URLs and navigate away.
      photos.forEach((p) => p.url && URL.revokeObjectURL(p.url));
      router.push("/drafts");
    } catch (err) {
      console.error("Create draft error:", err);
      setError(err.message || "Something went wrong");
      setSubmitting(false);
    }
  }

  if (phase === "capture") {
    return <Camera onDone={handleCameraDone} onCancel={handleCameraCancel} />;
  }

  // Review phase — fixed full-screen so it escapes the root layout's
  // BottomNav padding. Internal flex column: sticky header, scrollable
  // grid, sticky action bar.
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          onClick={backToCamera}
          className="text-sm text-zinc-300 hover:text-white"
        >
          ← Retake
        </button>
        <h1 className="text-sm font-semibold">
          Review ({photos.length} photo{photos.length === 1 ? "" : "s"})
        </h1>
        <span className="text-xs text-zinc-400">
          {aiSelected.size} for AI
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <p className="text-xs text-zinc-400">
            Tap photos to mark them for AI analysis (use your strongest front /
            tag / detail shots). All photos go on the listing.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-3 gap-1 px-1 pb-4 sm:gap-2 sm:px-2">
          {photos.map((p, i) => {
          const selected = aiSelected.has(i);
          return (
            <div key={i} className="relative aspect-square">
              <button
                onClick={() => toggleAi(i)}
                className={`relative block h-full w-full overflow-hidden rounded-md border-2 transition-colors ${
                  selected ? "border-blue-500" : "border-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                {selected && (
                  <div className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white shadow">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium">
                  #{i + 1}
                </div>
              </button>
              <button
                onClick={() => removePhoto(i)}
                aria-label={`Delete photo ${i + 1}`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
        </div>

        {error && (
          <div className="mx-4 mt-4 rounded border border-red-700 bg-red-950/60 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Bottom action bar — flex item, not fixed, since the parent is a
          full-screen flex column. Avoids stacking under anything. */}
      <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <button
          onClick={handleCreateDraft}
          disabled={submitting || photos.length === 0}
          className="w-full rounded-full bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {submitting
            ? "Uploading…"
            : `Create Draft (${photos.length} photo${photos.length === 1 ? "" : "s"}, ${aiSelected.size} AI)`}
        </button>
      </div>
    </div>
  );
}
