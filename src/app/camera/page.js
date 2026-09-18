"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Camera from "@/components/Camera";
import { CheckIcon, ChevronLeftIcon, XIcon } from "@/components/ui/Icons";

// /camera — phone only, full screen, no nav bar.
//
// Two phases:
//   1. Capture — live viewfinder. Snap any number of photos, then Done.
//   2. Review — grid of the photos. Tap the ones the AI should read,
//      delete any you don't want, and Create Draft to kick off the
//      background pipeline.
//
// ← Back (Review → Capture) KEEPS every photo, the AI picks and both notes;
// new shots are added to the end. The close ✕ is the way to start over
// (it asks before throwing photos away).
//
// On Create Draft:
//   - Upload every photo to Cloudinary under the "All Photos" library folder.
//   - Fire-and-forget POST /api/drafts/process with the full listingPhotos
//     array + aiPhotoIndices subset.
//   - Navigate to /drafts so the in-flight row shows.
export default function CameraPage() {
  const router = useRouter();
  const [phase, setPhase] = useState("capture"); // "capture" | "review"
  const [photos, setPhotos] = useState([]); // [{ blob, url }]
  // AI picks are kept by photo (its blob URL), not by position, so removing
  // a shot in the camera strip can't shift the picks onto other photos.
  const [aiPicked, setAiPicked] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total }
  const [error, setError] = useState("");
  // aiNote is read by Claude during analysis; draftNote is internal only.
  const [aiNote, setAiNote] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [noteModal, setNoteModal] = useState(null); // "ai" | "draft" | null
  const [noteDraft, setNoteDraft] = useState("");

  function openNoteModal(which) {
    setNoteDraft(which === "ai" ? aiNote : draftNote);
    setNoteModal(which);
  }
  function saveNoteModal() {
    if (noteModal === "ai") setAiNote(noteDraft);
    else if (noteModal === "draft") setDraftNote(noteDraft);
    setNoteModal(null);
    setNoteDraft("");
  }
  function cancelNoteModal() {
    setNoteModal(null);
    setNoteDraft("");
  }

  function releaseAll(list) {
    list.forEach((p) => p.url && URL.revokeObjectURL(p.url));
  }

  function handleCameraDone(captured) {
    // Photos removed in the camera strip: release them and drop their picks.
    const keep = new Set(captured.map((p) => p.url));
    photos.forEach((p) => {
      if (!keep.has(p.url)) URL.revokeObjectURL(p.url);
    });
    setPhotos(captured);
    // Nothing is picked for the AI automatically — you pick them in Review.
    // Picks made before ← Back are kept (minus any photos removed since).
    setAiPicked((prev) => new Set([...prev].filter((u) => keep.has(u))));
    setPhase("review");
  }

  function handleCameraClose(current) {
    if (
      current.length > 0 &&
      !window.confirm(
        `Discard ${current.length === 1 ? "this photo" : `all ${current.length} photos`} and close the camera?`
      )
    ) {
      return;
    }
    releaseAll(current);
    router.push("/drafts");
  }

  function toggleAi(url) {
    setAiPicked((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function removePhoto(index) {
    const removed = photos[index];
    if (removed?.url) URL.revokeObjectURL(removed.url);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setAiPicked((prev) => {
      const next = new Set(prev);
      next.delete(removed?.url);
      return next;
    });
  }

  const aiCount = photos.filter((p) => aiPicked.has(p.url)).length;

  async function handleCreateDraft() {
    if (photos.length === 0 || submitting) return;
    setSubmitting(true);
    setError("");
    setUploadProgress({ done: 0, total: photos.length });
    try {
      // 1. Upload photos to Cloudinary one at a time. Vercel caps request
      //    bodies at ~4.5MB, so batching multiple full-res photos in a
      //    single FormData blows past that and comes back as plain-text
      //    "Request Entity Too Large". Sequential uploads sidestep the cap
      //    and give us real-time progress for the UI.
      const ts = Date.now();
      const listingPhotos = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const formData = new FormData();
        const file = new File([p.blob], `camera-${ts}-${i}.jpg`, {
          type: "image/jpeg",
        });
        formData.append("files", file);
        formData.append("folder", "All Photos");

        const uploadRes = await fetch("/api/cloudinary/upload", {
          method: "POST",
          body: formData,
        });
        // Parse defensively — Vercel returns plain text on body-too-large.
        const raw = await uploadRes.text();
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(
            uploadRes.status === 413
              ? `Photo ${i + 1} too large — retry or reduce capture resolution`
              : `Upload failed (${uploadRes.status}): ${raw.slice(0, 80)}`
          );
        }
        if (!data.success || !data.photos?.[0]) {
          throw new Error(data.error || `Upload failed on photo ${i + 1}`);
        }
        listingPhotos.push(data.photos[0]);
        setUploadProgress({ done: i + 1, total: photos.length });
      }
      const aiPhotoIndices = photos
        .map((p, i) => (aiPicked.has(p.url) ? i : -1))
        .filter((i) => i >= 0);

      // Client-generated draft id makes the POST idempotent. This request is
      // fire-and-forget and we navigate away immediately, which tears down
      // the long-running connection (the pipeline takes 30-50s to respond);
      // the platform then retries the request. Carrying a stable id means the
      // retry overwrites the SAME draft instead of creating a duplicate.
      const draftId = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // 2. Fire-and-forget the background pipeline.
      fetch("/api/drafts/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          listingPhotos,
          aiPhotoIndices,
          aiNote,
          draftNote,
        }),
      }).catch((err) => {
        // Logged only — the server still writes an error draft on its side.
        console.error("Background process kickoff failed:", err);
      });

      // 3. Release blob URLs and navigate away.
      releaseAll(photos);
      router.push("/drafts");
    } catch (err) {
      console.error("Create draft error:", err);
      setError(err.message || "Something went wrong");
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  if (phase === "capture") {
    return <Camera initialPhotos={photos} onDone={handleCameraDone} onClose={handleCameraClose} />;
  }

  // Review — an ordinary app surface (it follows the theme), still full
  // screen with no nav bar because it's part of the camera flow.
  return (
    <div className="fixed inset-0 z-40 flex justify-center bg-panel text-ink">
      <div className="flex h-full w-full max-w-[640px] flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line pl-1 pr-1.5 pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            onClick={() => setPhase("capture")}
            disabled={submitting}
            className="inline-flex h-11 cursor-pointer items-center gap-[5px] rounded-card border-0 bg-transparent px-2.5 font-sans text-lg font-medium text-accent disabled:opacity-50"
          >
            <ChevronLeftIcon className="size-[18px]" strokeWidth={2.1} />
            Back
          </button>
          <div className="min-w-0 grow text-center">
            <p className="m-0 whitespace-nowrap text-xl font-semibold tracking-[-0.01em]">
              Review ({photos.length} photo{photos.length === 1 ? "" : "s"})
            </p>
          </div>
          <span className="shrink-0 rounded-[13px] bg-accent-weak px-2.5 py-[5px] text-base font-semibold text-accent">
            {aiCount} for AI
          </span>
        </div>

        <p className="hint shrink-0 px-3.5 py-2.5">
          Every photo goes on the listing in this order. Tap the ones the AI should read — your
          strongest front, tag and detail shots.
        </p>

        <div className="min-h-0 grow overflow-y-auto px-3 pb-3">
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => {
              const on = aiPicked.has(p.url);
              return (
                <div
                  key={p.url}
                  role="button"
                  tabIndex={0}
                  aria-pressed={on}
                  aria-label={`Photo ${i + 1}${on ? ", picked for AI" : ""}`}
                  onClick={() => toggleAi(p.url)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") toggleAi(p.url);
                  }}
                  className={`cell ${on ? "cell-on" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <span className={`tick size-[22px] ${on ? "tick-on" : "tick-off"}`} aria-hidden="true">
                    <CheckIcon className="size-[13px]" strokeWidth={3.2} />
                  </span>
                  <span className="num">#{i + 1}</span>
                  <button
                    type="button"
                    aria-label={`Delete photo ${i + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto(i);
                    }}
                    className="cellx"
                  >
                    <XIcon className="size-[11px]" strokeWidth={3} />
                  </button>
                </div>
              );
            })}
          </div>
          {error && (
            <p className="mt-3 rounded-bar border border-bad-line bg-bad-weak px-3 py-2 text-md font-medium text-bad">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-[9px] border-t border-line bg-panel px-3 pb-[max(26px,env(safe-area-inset-bottom))] pt-[11px]">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openNoteModal("ai")}
              className={`btn btn-touch min-w-0 flex-1 ${aiNote.trim() ? "btn-done" : ""}`}
            >
              {aiNote.trim() && <CheckIcon className="size-[15px]" strokeWidth={2.6} />}
              AI Note
            </button>
            <button
              type="button"
              onClick={() => openNoteModal("draft")}
              className={`btn btn-touch min-w-0 flex-1 ${draftNote.trim() ? "btn-done" : ""}`}
            >
              {draftNote.trim() && <CheckIcon className="size-[15px]" strokeWidth={2.6} />}
              Draft Note
            </button>
          </div>
          {submitting ? (
            <div className="flex flex-col gap-[7px]">
              <button type="button" className="btn btn-off btn-touch w-full" disabled>
                {uploadProgress ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…` : "Uploading…"}
              </button>
              {uploadProgress && (
                <span className="prog">
                  <span style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }} />
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCreateDraft}
              disabled={photos.length === 0}
              className="btn btn-primary btn-touch w-full"
            >
              Create Draft ({photos.length} photo{photos.length === 1 ? "" : "s"}, {aiCount} AI)
            </button>
          )}
        </div>
      </div>

      {/* Note editor — one popup for both notes. Red ✕ discards, green ✓ saves. */}
      {noteModal && (
        <div
          className="scrim"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelNoteModal();
          }}
        >
          <div className="dialog" role="dialog" aria-modal="true">
            <div className="mb-2.5 flex items-center gap-2">
              <p className="m-0 text-2xl font-semibold">{noteModal === "ai" ? "AI Note" : "Draft Note"}</p>
              <div className="grow" />
              <button type="button" className="roundbtn roundbtn-no size-[52px]" aria-label="Cancel" onClick={cancelNoteModal}>
                <XIcon className="size-5" />
              </button>
              <button type="button" className="roundbtn roundbtn-yes size-[52px]" aria-label="Save" onClick={saveNoteModal}>
                <CheckIcon className="size-5" strokeWidth={2.8} />
              </button>
            </div>
            <label className="lbl mb-1.5 block" htmlFor="note-box">
              {noteModal === "ai" ? "Sent with the photos" : "Kept on the draft"}
            </label>
            <textarea
              id="note-box"
              autoFocus
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              className="textarea-touch min-h-[132px]"
              placeholder={
                noteModal === "ai"
                  ? "e.g. tag says 32 but it measures 30 — use the measured size"
                  : "Notes for yourself — not sent to eBay"
              }
            />
            <p className="hint mt-2">
              {noteModal === "ai"
                ? "Goes to the AI with the photos you picked. It's the fastest way to fix a wrong size or catch a flaw."
                : "Only you see this. It stays on the draft and is never sent to eBay."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
