"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlipIcon, TorchIcon, XIcon } from "@/components/ui/Icons";

// Camera component — full-screen in-app viewfinder using getUserMedia.
//
// Props:
//   initialPhotos           — photos already taken (coming back from Review
//                             with ← Back keeps them; new shots are added
//                             to the end).
//   onDone(capturedPhotos)  — called with the full photo list on Done.
//   onClose(photos)         — called by the close ✕. The page asks before
//                             discarding any photos.
//
// Each captured photo is a square 1:1 crop taken from the center of the
// camera frame, encoded as JPEG. The caller is responsible for uploading
// those blobs to Cloudinary.
//
// Manual controls: ISO, shutter speed (exposureTime), and white balance
// (colorTemperature). All three only render when the underlying track
// exposes them (Android Chrome typically does; iOS Safari usually doesn't).
// Touching a slider flips its mode to manual; the Auto button resets that
// control to continuous so the camera handles it again. The three modes
// are independent — locking WB doesn't affect ISO/shutter and vice versa.
// Standard ISO stops (1/3-stop increments through 800, then full-stop jumps
// to 1600 and 3200) — matches what native camera apps expose. Filtered at
// stream start to whatever range the device actually supports.
const ISO_PRESETS = [
  50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1600, 3200,
];

// White balance presets. The browser API exposes a continuous Kelvin range,
// but Android Chrome drivers (notably Samsung) actually snap to a small
// number of discrete values internally — verified by reading getSettings()
// after applyConstraints. These presets match the values our test device
// actually produces: a slider would have dead zones between them and feel
// broken; tapping a button you know maps to a real driver value is honest.
const WB_PRESETS = [
  { label: "Indoor", k: 2850 },
  { label: "Cool", k: 4250 },
  { label: "Daylight", k: 5000 },
  { label: "Cloudy", k: 6000 },
];

export default function Camera({ initialPhotos = [], onDone, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const thumbStripRef = useRef(null);
  // Web Audio refs — HTMLAudioElement.play() has a 50-200ms warmup delay on
  // mobile even with preload. Web Audio plays a pre-decoded buffer with
  // essentially zero latency, which is what you want for a shutter sound.
  const audioCtxRef = useRef(null);
  const shutterBufferRef = useRef(null);

  const [photos, setPhotos] = useState(initialPhotos); // [{ blob, url }]
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  const [facingMode, setFacingMode] = useState("environment"); // "environment" | "user"
  const [flashOn, setFlashOn] = useState(false); // torch constraint if supported
  const [zoom, setZoom] = useState(1); // 1 | 2 | 3
  const [capabilities, setCapabilities] = useState(null);
  const [isoMode, setIsoMode] = useState("auto"); // "auto" | "manual"
  const [isoStops, setIsoStops] = useState([]); // presets clamped to device range
  const [isoIndex, setIsoIndex] = useState(0); // index into isoStops
  const iso = isoStops[isoIndex] ?? 400;
  const [shutterMode, setShutterMode] = useState("auto"); // "auto" | "manual"
  const [shutter, setShutter] = useState(100); // exposureTime units (100µs typically)
  const [wbMode, setWbMode] = useState("auto"); // "auto" | "manual"
  const [wbTemp, setWbTemp] = useState(5000); // colorTemperature in Kelvin
  const [focusPoint, setFocusPoint] = useState(null); // { x, y } in viewfinder px, for the animated indicator

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

      // Detect capabilities (zoom, torch, iso, exposureTime, whiteBalance)
      // — Android Chrome typically exposes these, iOS Safari usually not.
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      setCapabilities(caps);

      // Reset all manual controls on a fresh stream.
      setZoom(1);
      setFlashOn(false);
      setIsoMode("auto");
      setShutterMode("auto");
      setWbMode("auto");
      // Seed each manual slider at the midpoint of its supported range so
      // the first user tap lands somewhere sensible.
      if (caps.iso) {
        const min = caps.iso.min ?? 50;
        const max = caps.iso.max ?? 3200;
        const stops = ISO_PRESETS.filter((v) => v >= min && v <= max);
        // Fallback: if the device's range doesn't overlap any preset, use
        // raw min/max so the slider still works.
        const finalStops = stops.length > 0 ? stops : [min, max];
        setIsoStops(finalStops);
        setIsoIndex(Math.floor(finalStops.length / 2));
      } else {
        setIsoStops([]);
        setIsoIndex(0);
      }
      if (caps.exposureTime) {
        const min = caps.exposureTime.min ?? 1;
        const max = caps.exposureTime.max ?? 1000;
        setShutter(Math.round((min + max) / 2));
      }
      if (caps.colorTemperature) {
        const min = caps.colorTemperature.min ?? 2850;
        const max = caps.colorTemperature.max ?? 7000;
        setWbTemp(Math.round((min + max) / 2));
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

  // Apply white balance in TWO sequential applyConstraints calls — mode
  // first, then colorTemperature. Combining them in one call worked on
  // some devices but on Samsung Android Chrome the driver wouldn't honor
  // the colorTemperature change unless the whiteBalanceMode transition
  // was processed separately first. The await between calls lets the
  // driver settle before we feed it the next constraint.
  //
  // Tap-Auto-then-preset behavior reported by the user implied the
  // driver was only applying on a mode transition; this split makes the
  // mode transition explicit and standalone.
  useEffect(() => {
    let cancelled = false;
    async function applyWb() {
      const track = streamRef.current?.getVideoTracks?.()[0];
      if (!track) return;
      const caps = track.getCapabilities?.() || {};
      if (!caps.whiteBalanceMode) return;

      try {
        // Step 1 — set the mode. Driver handles the transition cleanly
        // when this is the only thing in the constraint.
        await track.applyConstraints({
          advanced: [
            {
              whiteBalanceMode: wbMode === "manual" ? "manual" : "continuous",
            },
          ],
        });
        if (cancelled) return;

        // Step 2 — only if we're in manual, apply the desired Kelvin.
        // The driver should now be in manual mode and ready to honor it.
        if (wbMode === "manual" && caps.colorTemperature) {
          await track.applyConstraints({
            advanced: [{ colorTemperature: wbTemp }],
          });
        }
      } catch (e) {
        console.error("[Camera] wb applyConstraints:", e);
      }
    }
    applyWb();
    return () => {
      cancelled = true;
    };
  }, [wbMode, wbTemp]);

  const hasHardwareZoom = !!capabilities?.zoom;
  const hasTorch = !!capabilities?.torch;
  const hasIso = !!capabilities?.iso && isoStops.length > 0;
  const hasShutter = !!capabilities?.exposureTime;
  const shutterMin = capabilities?.exposureTime?.min ?? 1;
  const shutterMax = capabilities?.exposureTime?.max ?? 1000;
  const shutterStep = capabilities?.exposureTime?.step || 1;
  const hasWb =
    !!capabilities?.whiteBalanceMode && !!capabilities?.colorTemperature;

  // Tap-to-focus handler. Called on the viewfinder area. Computes the tap
  // location as normalized [0,1] coords and sends pointsOfInterest +
  // focusMode=single-shot to the track. Also sets a short-lived focusPoint
  // state so the UI can render a yellow square confirmation at that spot.
  function handleViewfinderTap(e) {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track || !videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // Prefer touch coordinates on mobile (changedTouches fires on touchend).
    const pointer = e.changedTouches?.[0] || e;
    const localX = pointer.clientX - rect.left;
    const localY = pointer.clientY - rect.top;
    const normX = Math.max(0, Math.min(1, localX / rect.width));
    const normY = Math.max(0, Math.min(1, localY / rect.height));

    // Animated indicator.
    setFocusPoint({ x: localX, y: localY, at: Date.now() });

    const caps = track.getCapabilities?.() || {};
    // Driver has to support at least one of these for a tap to mean
    // anything — most Android Chrome does, iOS Safari doesn't.
    if (!caps.pointsOfInterest && !caps.focusMode) return;

    const constraints = [];
    if (caps.focusMode?.includes?.("single-shot")) {
      constraints.push({ focusMode: "single-shot" });
    } else if (caps.focusMode?.includes?.("manual")) {
      constraints.push({ focusMode: "manual" });
    }
    if (caps.pointsOfInterest) {
      constraints.push({ pointsOfInterest: [{ x: normX, y: normY }] });
    }
    track
      .applyConstraints({ advanced: constraints })
      .catch((err) => console.error("[Camera] focus applyConstraints:", err));
  }

  // Preload the shutter sound into a Web Audio buffer on mount. Decoded
  // once, then replayed with zero latency on each capture via a fresh
  // AudioBufferSourceNode.
  useEffect(() => {
    let cancelled = false;
    const Ctx = typeof window !== "undefined"
      ? window.AudioContext || window.webkitAudioContext
      : null;
    if (!Ctx) return;
    const ctx = new Ctx();
    audioCtxRef.current = ctx;
    fetch("/sounds/shutter.wav")
      .then((r) => r.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        if (!cancelled) shutterBufferRef.current = decoded;
      })
      .catch((e) => console.error("[Camera] shutter decode failed:", e));
    return () => {
      cancelled = true;
      ctx.close().catch(() => {});
    };
  }, []);

  // Auto-scroll the thumbnail strip to the end whenever a new photo is added,
  // so the latest capture is always visible without manual scrolling.
  useEffect(() => {
    const el = thumbStripRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }, [photos.length]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    // Play shutter sound as early as possible so the audible feedback lines
    // up with the button tap, not the canvas encode. Uses Web Audio for
    // near-zero latency (HTMLAudio has a 50-200ms warmup on mobile).
    const audioCtx = audioCtxRef.current;
    const buf = shutterBufferRef.current;
    if (audioCtx && buf) {
      // iOS/Chrome may suspend the context until a user gesture — capture
      // is a tap, so resume() is safe here. resume() is a no-op if running.
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(audioCtx.destination);
      src.start(0);
    }

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
    // The page confirms before discarding photos and stops the camera by
    // unmounting us (the stream cleanup above runs then).
    onClose?.(photos);
  }

  function toggleFacing() {
    setFacingMode((f) => (f === "environment" ? "user" : "environment"));
  }

  // Blob URLs are released by the page (they outlive this component when
  // going to Review and coming back with ← Back).


  const videoScaleStyle = hasHardwareZoom
    ? undefined
    : { transform: `scale(${zoom})`, transformOrigin: "center center" };

  // Capture chrome is always dark (it sits over a live viewfinder). Layout,
  // top to bottom: bar · square viewfinder · exposure / white balance · the
  // strip of shots · shutter row. The strip is always rendered at its full
  // height so NOTHING moves when the first photo is taken — a layout jump
  // made people re-aim between shots and changed the perspective.
  return (
    <div className="cap fixed inset-0 z-50 flex justify-center">
      <div className="flex h-full w-full max-w-[430px] flex-col">
        {/* Top bar: close · photo count · torch */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-2.5 pt-[env(safe-area-inset-top)]">
          <button type="button" onClick={handleClose} aria-label="Close camera" className="icobtn">
            <XIcon className="size-5" strokeWidth={2.2} />
          </button>
          <div className="flex grow justify-center">
            <span className="mono rounded-[14px] bg-white/10 px-3 py-[5px] text-base font-semibold">
              {photos.length} photo{photos.length === 1 ? "" : "s"}
            </span>
          </div>
          {/* The torch — a plain on/off, starting Off. */}
          <button
            type="button"
            onClick={() => setFlashOn((f) => !f)}
            disabled={!hasTorch}
            aria-label="Torch"
            aria-pressed={flashOn}
            className={`icobtn ${flashOn ? "icobtn-on" : ""}`}
          >
            <TorchIcon on={flashOn} />
          </button>
        </div>

        {/* Viewfinder — a square that matches exactly what handleCapture
            crops from the source (WYSIWYG). Sized to leave room for the
            controls on shorter phones. */}
        <div
          className="relative mx-auto aspect-square shrink-0 overflow-hidden bg-[#14181e]"
          style={{ width: "min(100%, calc(100dvh - 360px))" }}
          onClick={error ? undefined : handleViewfinderTap}
        >
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-md text-[#ff8a7c]">
              {error}
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="absolute inset-0 h-full w-full object-cover"
                style={videoScaleStyle}
              />
              {/* 3×3 framing grid — drawn over the preview, never captured. */}
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/20" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/20" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/20" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/20" />
              {/* Focus reticle: centred until you tap, then at the tap point. */}
              <span
                key={focusPoint?.at || "centre"}
                aria-hidden="true"
                className="pointer-events-none absolute size-[78px] -translate-x-1/2 -translate-y-1/2 rounded-md border-[1.5px] border-[rgb(255_214_102/.95)]"
                style={{
                  left: focusPoint ? focusPoint.x : "50%",
                  top: focusPoint ? focusPoint.y : "50%",
                  animation: focusPoint ? "focusPulse 600ms ease-out" : undefined,
                }}
              />
              <span className="pointer-events-none absolute left-3 top-3 rounded-xl bg-[rgb(6_8_11/.5)] px-[9px] py-1 text-sm font-medium">
                Tap to focus
              </span>
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-md">
                  Starting camera…
                </div>
              )}
              {/* Zoom sits on the viewfinder, bottom centre. */}
              <div
                className="absolute inset-x-0 bottom-3 flex justify-center gap-[7px]"
                onClick={(e) => e.stopPropagation()}
              >
                {[1, 2, 3].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoom(z)}
                    aria-pressed={zoom === z}
                    className={`cpill ${zoom === z ? "cpill-on" : ""}`}
                  >
                    {z}x
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <style jsx>{`
          @keyframes focusPulse {
            0% {
              transform: translate(-50%, -50%) scale(1.4);
              opacity: 0;
            }
            30% {
              opacity: 1;
            }
            100% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
          }
        `}</style>

        <div className="flex min-h-0 grow flex-col justify-between gap-[11px] px-3 pt-[15px]">
          {/* ISO and Shutter only on phones that expose manual exposure. */}
          {hasIso && (
            <div className={`flex items-center gap-2.5 ${isoMode === "auto" ? "slider-off" : ""}`}>
              <span className="lbl w-[52px] shrink-0 text-[rgb(242_244_247/.66)]">ISO</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, isoStops.length - 1)}
                step={1}
                value={isoIndex}
                onChange={(e) => {
                  setIsoIndex(Number(e.target.value));
                  setIsoMode("manual");
                }}
                className="cam-range"
                aria-label="ISO"
              />
              <span className={`mono w-11 shrink-0 text-right text-base ${isoMode === "manual" ? "" : "text-[rgb(242_244_247/.45)]"}`}>
                {isoMode === "manual" ? iso : "Auto"}
              </span>
              <button
                type="button"
                onClick={() => setIsoMode("auto")}
                aria-pressed={isoMode === "auto"}
                className={`cpill ${isoMode === "auto" ? "cpill-on" : ""}`}
              >
                Auto
              </button>
            </div>
          )}
          {hasShutter && (
            <div className={`flex items-center gap-2.5 ${shutterMode === "auto" ? "slider-off" : ""}`}>
              <span className="lbl w-[52px] shrink-0 text-[rgb(242_244_247/.66)]">Shutter</span>
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
                className="cam-range"
                aria-label="Shutter speed"
              />
              <span className={`mono w-11 shrink-0 text-right text-base ${shutterMode === "manual" ? "" : "text-[rgb(242_244_247/.45)]"}`}>
                {shutterMode === "manual" ? shutter : "Auto"}
              </span>
              <button
                type="button"
                onClick={() => setShutterMode("auto")}
                aria-pressed={shutterMode === "auto"}
                className={`cpill ${shutterMode === "auto" ? "cpill-on" : ""}`}
              >
                Auto
              </button>
            </div>
          )}
          {hasWb && (
            <div className="flex items-center gap-1.5">
              <span className="lbl w-[52px] shrink-0 text-[rgb(242_244_247/.66)]">White</span>
              <div className="flex min-w-0 flex-1 gap-[5px]">
                <button
                  type="button"
                  onClick={() => setWbMode("auto")}
                  aria-pressed={wbMode === "auto"}
                  className={`cpill min-w-0 flex-1 px-1 ${wbMode === "auto" ? "cpill-on" : ""}`}
                >
                  Auto
                </button>
                {WB_PRESETS.map((p) => {
                  const active = wbMode === "manual" && wbTemp === p.k;
                  return (
                    <button
                      key={p.k}
                      type="button"
                      title={`${p.k}K`}
                      onClick={() => {
                        setWbTemp(p.k);
                        setWbMode("manual");
                      }}
                      aria-pressed={active}
                      className={`cpill min-w-0 flex-1 px-1 ${active ? "cpill-on" : ""}`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Thumbnail strip — fixed 64px, rendered even when empty. Swipes
              sideways with no scrollbar. */}
          <div ref={thumbStripRef} className="strip">
            {photos.map((p, i) => (
              <span key={p.url} className="cthumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="thumbx"
                >
                  <XIcon className="size-2.5" strokeWidth={3} />
                </button>
              </span>
            ))}
          </div>

          {/* Flip · shutter · Done */}
          <div className="flex items-center gap-3 pb-[max(26px,env(safe-area-inset-bottom))]">
            <button type="button" onClick={toggleFacing} aria-label="Flip camera" className="icobtn size-[52px] rounded-2xl">
              <FlipIcon className="size-[22px]" />
            </button>
            <div className="flex grow justify-center">
              <button
                type="button"
                onClick={handleCapture}
                disabled={!!error || starting}
                aria-label="Take photo"
                className="size-[72px] cursor-pointer rounded-full border-4 border-white/[0.28] bg-[#f2f4f7] p-0 shadow-[0_0_0_2px_rgba(6,8,11,.4)] transition-transform active:scale-95 disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              onClick={handleDone}
              disabled={photos.length === 0}
              className={`cpill cpill-lg min-w-[92px] ${photos.length > 0 ? "cpill-on" : "opacity-60"}`}
            >
              Done{photos.length > 0 ? ` (${photos.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
