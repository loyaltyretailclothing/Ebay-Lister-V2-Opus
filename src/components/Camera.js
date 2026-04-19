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
  const [wbMode, setWbMode] = useState("auto"); // "auto" | "manual"
  const [colorTemp, setColorTemp] = useState(5500); // Kelvin, when wbMode=manual
  const [isoMode, setIsoMode] = useState("auto"); // "auto" | "manual"
  const [iso, setIso] = useState(400); // when isoMode=manual
  const [showDiag, setShowDiag] = useState(false); // capabilities diagnostic panel
  const [constraintErr, setConstraintErr] = useState(""); // last applyConstraints error
  const [liveSettings, setLiveSettings] = useState(null); // last track.getSettings() snapshot

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

      // Detect capabilities (zoom, torch) — Android typically exposes, iOS usually not.
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      setCapabilities(caps);

      // Reset zoom / flash / WB / ISO state on a fresh stream.
      setZoom(1);
      setFlashOn(false);
      setWbMode("auto");
      setIsoMode("auto");
      setConstraintErr("");
      // Seed colorTemp / ISO at the midpoint of each supported range so
      // the first manual tap lands somewhere sensible.
      if (caps.colorTemperature) {
        const min = caps.colorTemperature.min ?? 2500;
        const max = caps.colorTemperature.max ?? 7500;
        setColorTemp(Math.round((min + max) / 2));
      }
      if (caps.iso) {
        const min = caps.iso.min ?? 100;
        const max = caps.iso.max ?? 800;
        setIso(Math.round((min + max) / 2));
      }
      // Log for diagnostic / debugging on real devices.
      console.log("[Camera] capabilities:", caps);
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
    // CSS fallback handled inline on the <video> style.
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

  // Apply white balance. Auto = continuous (let the camera decide),
  // Manual = lock to the user's chosen colorTemp Kelvin value.
  //
  // On Samsung Chrome, sending { whiteBalanceMode, colorTemperature }
  // together in one advanced block silently loses the temperature — the
  // auto WB keeps winning. Splitting into two sequential applyConstraints
  // calls (mode first, then temperature) forces it to stick. Also using
  // top-level constraints instead of `advanced` so the browser treats
  // them as required rather than best-effort.
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    const caps = track.getCapabilities?.() || {};
    if (!caps.colorTemperature) return;

    let cancelled = false;
    (async () => {
      try {
        if (wbMode === "manual") {
          await track.applyConstraints({ whiteBalanceMode: "manual" });
          if (cancelled) return;
          await track.applyConstraints({ colorTemperature: colorTemp });
        } else {
          await track.applyConstraints({ whiteBalanceMode: "continuous" });
        }
        const s = track.getSettings?.();
        setLiveSettings(s || null);
        console.log(
          "[Camera] WB applied — mode:", wbMode,
          "temp:", colorTemp,
          "→ settings.colorTemperature:", s?.colorTemperature,
          "settings.whiteBalanceMode:", s?.whiteBalanceMode
        );
      } catch (e) {
        if (cancelled) return;
        console.error("[Camera] WB applyConstraints failed:", e);
        setConstraintErr(`WB: ${e.name || e.message || "rejected"}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wbMode, colorTemp]);

  // Apply ISO. Requires exposureMode=manual on most devices for the ISO
  // constraint to actually take effect.
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    const caps = track.getCapabilities?.() || {};
    if (!caps.iso) return;
    const constraint =
      isoMode === "manual"
        ? { exposureMode: "manual", iso: iso }
        : { exposureMode: "continuous" };
    track
      .applyConstraints({ advanced: [constraint] })
      .then(() => {
        const s = track.getSettings?.();
        console.log("[Camera] ISO applied:", constraint, "→ settings:", s);
      })
      .catch((e) => {
        console.error("[Camera] ISO applyConstraints failed:", e);
        setConstraintErr(`ISO: ${e.name || e.message || "rejected"}`);
      });
  }, [isoMode, iso]);

  const hasHardwareZoom = !!capabilities?.zoom;
  const hasTorch = !!capabilities?.torch;
  const hasWhiteBalance = !!capabilities?.colorTemperature;
  const hasIso = !!capabilities?.iso;
  const wbMin = capabilities?.colorTemperature?.min ?? 2500;
  const wbMax = capabilities?.colorTemperature?.max ?? 7500;
  const wbStep = capabilities?.colorTemperature?.step || 100;
  const isoMin = capabilities?.iso?.min ?? 100;
  const isoMax = capabilities?.iso?.max ?? 800;
  const isoStep = capabilities?.iso?.step || 50;

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

      {/* Manual controls — White Balance + ISO. Each row hides itself
          automatically if the device doesn't expose that capability. */}
      {hasWhiteBalance && (
        <div className="flex items-center gap-2 px-4 pt-2">
          <span className="w-12 text-[10px] font-semibold uppercase tracking-wide text-white/70">WB</span>
          <button
            onClick={() => setWbMode("auto")}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur ${
              wbMode === "auto" ? "bg-white text-black" : "bg-black/40 text-white"
            }`}
          >
            Auto
          </button>
          <input
            type="range"
            min={wbMin}
            max={wbMax}
            step={wbStep}
            value={colorTemp}
            onChange={(e) => {
              setColorTemp(Number(e.target.value));
              setWbMode("manual");
            }}
            className="flex-1 accent-white"
            aria-label="White balance color temperature"
          />
          <span className="w-12 text-right text-[10px] font-medium tabular-nums">
            {wbMode === "manual" ? `${colorTemp}K` : "Auto"}
          </span>
        </div>
      )}
      {hasIso && (
        <div className="flex items-center gap-2 px-4 pt-1">
          <span className="w-12 text-[10px] font-semibold uppercase tracking-wide text-white/70">ISO</span>
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
      {/* Diagnostic chip — tap to expand the caps object so we can see
          which manual controls the device actually exposed. */}
      <div className="flex items-center justify-center gap-2 px-4 pt-1 text-[10px] text-white/60">
        <button
          onClick={() => setShowDiag((v) => !v)}
          className="rounded-full bg-black/30 px-2 py-0.5"
        >
          {showDiag ? "Hide caps" : "Caps"}
        </button>
        <span>
          Zoom {hasHardwareZoom ? "✓" : "✗"} · Flash {hasTorch ? "✓" : "✗"} ·
          WB {hasWhiteBalance ? "✓" : "✗"} · ISO {hasIso ? "✓" : "✗"}
        </span>
        {constraintErr && <span className="text-red-300">{constraintErr}</span>}
      </div>
      {/* Live-applied settings readout so we can see what the browser is
          actually holding vs what the slider says. Useful for diagnosing
          silent constraint rejections on devices like S25 Ultra. */}
      {liveSettings && (
        <div className="px-4 pt-0.5 text-center text-[10px] text-white/50">
          applied: WB={liveSettings.whiteBalanceMode || "?"} @
          {" "}{liveSettings.colorTemperature ?? "?"}K · ISO=
          {liveSettings.iso ?? "?"} · exp=
          {liveSettings.exposureMode || "?"}
        </div>
      )}
      {showDiag && capabilities && (
        <pre className="mx-4 mt-1 max-h-32 overflow-auto rounded bg-black/60 p-2 text-[9px] text-white/80">
          {JSON.stringify(capabilities, null, 2)}
        </pre>
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
