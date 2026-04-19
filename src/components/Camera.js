"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Camera component — full-screen in-app viewfinder using getUserMedia.
//
// Props:
//   onDone(capturedPhotos)  — called with an array of Blob photos when the
//                             user taps Done (or the X close button with
//                             any photos captured).
//   onCancel()              — called if the user taps X with no photos.
//
// Each captured photo is a square 1:1 crop taken from the center of the
// camera frame, encoded as JPEG. The caller is responsible for uploading
// those blobs to Cloudinary.
//
// Manual controls: ISO and shutter speed (exposureTime). Both only render
// when the underlying track exposes them (Android Chrome usually does; iOS
// Safari doesn't). Hardware white balance is intentionally NOT exposed —
// Samsung drivers accept the constraint but silently ignore it, so the
// slider was misleading. Best practice: set your lighting to ~5000K
// daylight with high-CRI bulbs and let the phone's AWB handle it.
export default function Camera({ onDone, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const [photos, setPhotos] = useState([]); // [{ blob, url }]
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  const [facingMode, setFacingMode] = useState("environment"); // "environment" | "user"
  const [flashOn, setFlashOn] = useState(false); // torch constraint if supported
  const [zoom, setZoom] = useState(1); // 1 | 2 | 3
  const [capabilities, setCapabilities] = useState(null);
  const [isoMode, setIsoMode] = useState("auto"); // "auto" | "manual"
  const [iso, setIso] = useState(400);
  const [shutterMode, setShutterMode] = useState("auto"); // "auto" | "manual"
  const [shutter, setShutter] = useState(100); // exposureTime units (100µs typically)

  // Start / restart the camera stream whenever facingMode changes.
  const startStream = useCallback(async () => {
    setStarting(true);
    setError("");
    try {
      // Stop any existing stream first.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1920 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Detect capabilities (zoom, torch, iso, exposureTime) — Android
      // typically exposes these, iOS usually not.
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      setCapabilities(caps);

      // Reset all manual controls on a fresh stream.
      setZoom(1);
      setFlashOn(false);
      setIsoMode("auto");
      setShutterMode("auto");
      // Seed each manual slider at the midpoint of its supported range so
      // the first user tap lands somewhere sensible.
      if (caps.iso) {
        const min = caps.iso.min ?? 100;
        const max = caps.iso.max ?? 800;
        setIso(Math.round((min + max) / 2));
      }
      if (caps.exposureTime) {
        const min = caps.exposureTime.min ?? 1;
        const max = caps.exposureTime.max ?? 1000;
        setShutter(Math.round((min + max) / 2));
      }
    } catch (err) {
      console.error("Camera start error:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Enable it in your browser settings and reload."
          : err.message || "Could not access camera"
      );
    } finally {
      setStarting(false);
    }
  }, [facingMode]);

  useEffect(() => {
    startStream();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [startStream]);

  // Apply zoom via MediaTrack constraint when the browser supports it.
  // Falls back to CSS scale on the video element otherwise (digital zoom).
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    const caps = track.getCapabilities?.() || {};
    if (caps.zoom) {
      const min = caps.zoom.min ?? 1;
      const max = caps.zoom.max ?? 3;
      const target = Math.min(max, Math.max(min, zoom));
      track.applyConstraints({ advanced: [{ zoom: target }] }).catch(() => {});
    }
  }, [zoom]);

  // Apply torch/flash constraint when supported.
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    const caps = track.getCapabilities?.() || {};
    if (caps.torch) {
      track.applyConstraints({ advanced: [{ torch: flashOn }] }).catch(() => {});
    }
  }, [flashOn]);

  // Apply ISO + exposureTime together. exposureMode has to be "manual" for
  // either one to take effect; flipping back to "continuous" un-locks both.
  // Both sliders live in the same constraint so toggling one doesn't clobber
  // the other.
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    const caps = track.getCapabilities?.() || {};
    const needsManual = isoMode === "manual" || shutterMode === "manual";
    const constraint = { exposureMode: needsManual ? "manual" : "continuous" };
    if (isoMode === "manual" && caps.iso) constraint.iso = iso;
    if (shutterMode === "manual" && caps.exposureTime) {
      constraint.exposureTime = shutter;
    }
    track
      .applyConstraints({ advanced: [constraint] })
      .catch((e) => console.error("[Camera] exposure applyConstraints:", e));
  }, [isoMode, iso, shutterMode, shutter]);

  const hasHardwareZoom = !!capabilities?.zoom;
  const hasTorch = !!capabilities?.torch;
  const hasIso = !!capabilities?.iso;
  const hasShutter = !!capabilities?.exposureTime;
  const isoMin = capabilities?.iso?.min ?? 100;
  const isoMax = capabilities?.iso?.max ?? 800;
  const isoStep = capabilities?.iso?.step || 50;
  const shutterMin = capabilities?.exposureTime?.min ?? 1;
  const shutterMax = capabilities?.exposureTime?.max ?? 1000;
  const shutterStep = capabilities?.exposureTime?.step || 1;

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    // Hard-crop to 1:1 from the center of the frame. eBay recommends square
    // photos at 1600x1600 — we capture at that resolution when possible.
    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    const side = Math.min(srcW, srcH);
    const sx = Math.floor((srcW - side) / 2);
    const sy = Math.floor((srcH - side) / 2);
    const outSize = Math.min(side, 1600);

    const canvas = canvasRef.current || document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.width = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext("2d");

    // If CSS-zoom fallback is active (no hardware zoom), emulate by scaling
    // the source rect so the captured image matches what the user sees.
    const effectiveSide = hasHardwareZoom ? side : side / zoom;
    const effectiveSx = sx + (side - effectiveSide) / 2;
    const effectiveSy = sy + (side - effectiveSide) / 2;

    ctx.drawImage(
      video,
      effectiveSx,
      effectiveSy,
      effectiveSide,
      effectiveSide,
      0,
      0,
      outSize,
      outSize
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setPhotos((prev) => [...prev, { blob, url }]);
      },
      "image/jpeg",
      0.9
    );
  }

  function handleRemove(index) {
    setPhotos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return next;
    });
  }

  function handleDone() {
    if (photos.length === 0) return;
    onDone?.(photos);
  }

  function handleClose() {
    // Stop stream explicitly — parent may unmount us or navigate away.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (photos.length > 0) onDone?.(photos);
    else onCancel?.();
  }

  function toggleFacing() {
    setFacingMode((f) => (f === "environment" ? "user" : "environment"));
  }

  // Release blob URLs when the component unmounts.
  useEffect(() => {
    return () => {
      photos.forEach((p) => p.url && URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const videoScaleStyle = hasHardwareZoom
    ? undefined
    : { transform: `scale(${zoom})`, transformOrigin: "center center" };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Top bar: close + flash */}
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={handleClose}
          aria-label="Close camera"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-sm font-medium opacity-80">
          {photos.length} photo{photos.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={() => setFlashOn((f) => !f)}
          disabled={!hasTorch}
          aria-label="Toggle flash"
          className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur ${
            hasTorch
              ? flashOn
                ? "bg-yellow-400 text-black"
                : "bg-black/40 text-white hover:bg-black/60"
              : "bg-black/20 text-white/40"
          }`}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill={flashOn ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
      </div>

      {/* Viewfinder with 1:1 square guide overlay */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {error ? (
          <div className="max-w-sm px-6 text-center text-sm text-red-300">
            {error}
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full object-cover"
              style={videoScaleStyle}
            />
            {/* Square 1:1 crop guide centered in the frame */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="aspect-square w-[min(90vw,90vh)] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm">
                Starting camera…
              </div>
            )}
          </>
        )}
      </div>

      {/* Manual controls — ISO + Shutter. Each row hides if the device
          doesn't expose that capability. Touching a slider flips its mode
          to manual; Auto button resets to continuous exposure. */}
      {hasIso && (
        <div className="flex items-center gap-2 px-4 pt-2">
          <span className="w-14 text-[10px] font-semibold uppercase tracking-wide text-white/70">ISO</span>
          <button
            onClick={() => setIsoMode("auto")}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur ${
              isoMode === "auto" ? "bg-white text-black" : "bg-black/40 text-white"
            }`}
          >
            Auto
          </button>
          <input
            type="range"
            min={isoMin}
            max={isoMax}
            step={isoStep}
            value={iso}
            onChange={(e) => {
              setIso(Number(e.target.value));
              setIsoMode("manual");
            }}
            className="flex-1 accent-white"
            aria-label="ISO"
          />
          <span className="w-12 text-right text-[10px] font-medium tabular-nums">
            {isoMode === "manual" ? iso : "Auto"}
          </span>
        </div>
      )}
      {hasShutter && (
        <div className="flex items-center gap-2 px-4 pt-1">
          <span className="w-14 text-[10px] font-semibold uppercase tracking-wide text-white/70">Shutter</span>
          <button
            onClick={() => setShutterMode("auto")}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur ${
              shutterMode === "auto" ? "bg-white text-black" : "bg-black/40 text-white"
            }`}
          >
            Auto
          </button>
          <input
            type="range"
            min={shutterMin}
            max={shutterMax}
            step={shutterStep}
            value={shutter}
            onChange={(e) => {
              setShutter(Number(e.target.value));
              setShutterMode("manual");
            }}
            className="flex-1 accent-white"
            aria-label="Shutter speed"
          />
          <span className="w-12 text-right text-[10px] font-medium tabular-nums">
            {shutterMode === "manual" ? shutter : "Auto"}
          </span>
        </div>
      )}

      {/* Zoom chips */}
      <div className="flex items-center justify-center gap-2 px-4 py-2">
        {[1, 2, 3].map((z) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={`rounded-full px-3 py-1 text-xs font-semibold backdrop-blur transition-colors ${
              zoom === z ? "bg-white text-black" : "bg-black/40 text-white hover:bg-black/60"
            }`}
          >
            {z}x
          </button>
        ))}
      </div>

      {/* Thumbnail strip */}
      {photos.length > 0 && (
        <div className="px-4 py-2">
          <div className="flex gap-2 overflow-x-auto">
            {photos.map((p, i) => (
              <div key={i} className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-white/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => handleRemove(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom controls: flip camera / shutter / done */}
      <div className="flex items-center justify-between px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <button
          onClick={toggleFacing}
          aria-label="Flip camera"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur hover:bg-black/60"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 3v4h4M8 21v-4H4M4 7a9 9 0 0114-4M20 17a9 9 0 01-14 4" />
          </svg>
        </button>

        <button
          onClick={handleCapture}
          disabled={!!error || starting}
          aria-label="Capture photo"
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/10 backdrop-blur transition-transform active:scale-95 disabled:opacity-50"
        >
          <span className="h-14 w-14 rounded-full bg-white" />
        </button>

        <button
          onClick={handleDone}
          disabled={photos.length === 0}
          className={`rounded-full px-4 py-2 text-sm font-semibold backdrop-blur transition-colors ${
            photos.length === 0
              ? "bg-black/30 text-white/40"
              : "bg-white text-black hover:bg-zinc-100"
          }`}
        >
          Done{photos.length > 0 ? ` (${photos.length})` : ""}
        </button>
      </div>
    </div>
  );
}
