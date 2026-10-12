"use client";

import { useRef, useState } from "react";

// DIAGNOSTIC ONLY — not linked from the nav, changes nothing, writes nothing.
//
// Built to answer one question: can the in-app camera offer a 0.8x preset
// like the phone's own camera app does?
//
// It cannot be answered from a desktop. Our zoom presets work by cropping
// the sensor of whichever lens is already open:
//
//   track.applyConstraints({ advanced: [{ zoom: target }] })
//
// That crops IN and never out, so the main lens cannot go below 1x. Anything
// wider is a physically different camera that has to be opened by deviceId.
// Whether the browser exposes it, and which manual controls survive on it,
// is entirely up to the phone — hence this page.
//
// Two things it reports, per back camera:
//   1. the zoom range, which says whether 0.8x is reachable at all
//   2. which manual controls exist — above all whiteBalanceMode, because the
//      Daylight preset is relied on and may not exist on the ultra-wide
//
// See docs/Architecture/Drafts and Camera Flow.md.

const KEYS = [
  ["zoom", "Zoom"],
  ["whiteBalanceMode", "White balance mode"],
  ["colorTemperature", "Colour temperature"],
  ["iso", "ISO"],
  ["exposureTime", "Shutter"],
  ["exposureMode", "Exposure mode"],
  ["focusMode", "Focus mode"],
  ["pointsOfInterest", "Tap to focus"],
  ["torch", "Torch"],
];

// Ranges come back as {min,max,step}, modes as arrays, torch as a boolean.
function show(v) {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") {
    const { min, max, step } = v;
    if (min === undefined && max === undefined) return JSON.stringify(v);
    return `${min} – ${max}${step ? ` (step ${step})` : ""}`;
  }
  return String(v);
}

export default function CameraCheckPage() {
  const [state, setState] = useState("idle"); // idle | running | done | error
  const [error, setError] = useState("");
  const [cams, setCams] = useState([]);
  const [raw, setRaw] = useState("");

  // Live zoom trial, run against one chosen camera.
  const [liveId, setLiveId] = useState(null);
  const [liveLog, setLiveLog] = useState([]);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  async function run() {
    setState("running");
    setError("");
    setCams([]);
    try {
      // Labels stay blank until permission has been granted once, so ask
      // first with a throwaway stream, then enumerate.
      const warmup = await navigator.mediaDevices.getUserMedia({ video: true });
      warmup.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === "videoinput");

      const out = [];
      for (const d of inputs) {
        // One at a time, each fully stopped before the next — some phones
        // refuse to open two physical cameras at once.
        let entry = { deviceId: d.deviceId, label: d.label || "(no label)" };
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: d.deviceId },
              width: { ideal: 1920 },
              height: { ideal: 1920 },
            },
          });
          const track = stream.getVideoTracks()[0];
          entry.caps = track.getCapabilities?.() || {};
          entry.settings = track.getSettings?.() || {};

          // A still from each lens, so the ultra-wide can be spotted by eye
          // rather than by guessing at labels like "camera2 2, facing back".
          const v = document.createElement("video");
          v.srcObject = stream;
          v.muted = true;
          v.playsInline = true;
          await v.play().catch(() => {});
          await new Promise((r) => setTimeout(r, 500));
          if (v.videoWidth) {
            const side = Math.min(v.videoWidth, v.videoHeight);
            const c = document.createElement("canvas");
            c.width = 200;
            c.height = 200;
            c.getContext("2d").drawImage(
              v,
              (v.videoWidth - side) / 2,
              (v.videoHeight - side) / 2,
              side,
              side,
              0,
              0,
              200,
              200
            );
            entry.thumb = c.toDataURL("image/jpeg", 0.7);
          }
          stream.getTracks().forEach((t) => t.stop());
        } catch (e) {
          entry.openError = `${e.name}: ${e.message}`;
        }
        out.push(entry);
        setCams([...out]);
      }

      setRaw(
        JSON.stringify(
          {
            userAgent: navigator.userAgent,
            cameras: out.map(({ thumb, ...rest }) => rest),
          },
          null,
          2
        )
      );
      setState("done");
    } catch (e) {
      setError(`${e.name}: ${e.message}`);
      setState("error");
    }
  }

  // Open one camera live and ask the driver for a series of zoom values,
  // reading back what it ACTUALLY set. A value that comes back unchanged
  // when asked for something lower is the clamp we care about.
  async function tryZooms(deviceId) {
    stopLive();
    setLiveId(deviceId);
    setLiveLog([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1920 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      const log = [];
      if (!caps.zoom) {
        log.push({ asked: "—", got: "this camera reports no zoom control at all" });
      } else {
        for (const asked of [caps.zoom.min, 0.6, 0.8, 1, 1.33, 2, 3]) {
          try {
            await track.applyConstraints({ advanced: [{ zoom: asked }] });
            await new Promise((r) => setTimeout(r, 200));
            const got = track.getSettings?.().zoom;
            log.push({ asked, got: String(got) });
          } catch (e) {
            log.push({ asked, got: `refused — ${e.name}` });
          }
        }
        await track.applyConstraints({ advanced: [{ zoom: 1 }] }).catch(() => {});
      }
      setLiveLog(log);
    } catch (e) {
      setLiveLog([{ asked: "—", got: `${e.name}: ${e.message}` }]);
    }
  }

  function stopLive() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLiveId(null);
    setLiveLog([]);
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-3 p-4">
      <h1 className="m-0 text-xl font-semibold">Camera check</h1>
      <p className="hint m-0">
        Diagnostic only — nothing here changes the camera you shoot with. Open this on the phone,
        tap Run, then send the result back.
      </p>

      <button type="button" className="btn btn-primary btn-lg" onClick={run} disabled={state === "running"}>
        {state === "running" ? "Checking…" : "Run the check"}
      </button>

      {error && (
        <p className="rounded-panel border border-bad-line bg-bad-weak px-3 py-2 text-md text-bad">
          {error}
        </p>
      )}

      {cams.map((c, i) => {
        const caps = c.caps || {};
        const zoomMin = caps.zoom?.min;
        return (
          <div key={c.deviceId || i} className="card">
            <div className="grouphead">
              <h2 className="lbl">Camera {i + 1}</h2>
              <div className="grow" />
              {caps.zoom && (
                <span className={`pill pill-skip ${zoomMin < 1 ? "font-semibold text-ink" : ""}`}>
                  {zoomMin < 1 ? `goes down to ${zoomMin}x` : "cannot go below 1x"}
                </span>
              )}
            </div>

            <div className="flex gap-3 px-3 py-2.5">
              {c.thumb && (
                <span
                  role="img"
                  aria-label={`View from camera ${i + 1}`}
                  className="block size-[110px] shrink-0 rounded-field border border-line bg-cover bg-center"
                  style={{ backgroundImage: `url(${c.thumb})` }}
                />
              )}
              <div className="min-w-0 grow">
                <p className="m-0 break-words text-md font-semibold">{c.label}</p>
                {c.settings?.width && (
                  <p className="hint m-0">
                    {c.settings.width} × {c.settings.height}
                  </p>
                )}
                {c.openError && <p className="m-0 text-md text-bad">{c.openError}</p>}
              </div>
            </div>

            <div className="border-t border-line px-3 py-2">
              {KEYS.map(([key, label]) => {
                const v = show(caps[key]);
                return (
                  <div key={key} className="flex gap-2 border-b border-line py-1 text-md last:border-b-0">
                    <span className="w-[150px] shrink-0 text-ink-2">{label}</span>
                    <span className={v ? "" : "text-ink-3"}>{v ?? "not supported"}</span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-line px-3 py-2">
              <button type="button" className="btn btn-sm" onClick={() => tryZooms(c.deviceId)}>
                Try zoom values on this camera
              </button>
            </div>
          </div>
        );
      })}

      {liveId && (
        <div className="card">
          <div className="grouphead">
            <h2 className="lbl">Zoom trial</h2>
            <div className="grow" />
            <button type="button" className="btn btn-sm" onClick={stopLive}>
              Stop
            </button>
          </div>
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-square w-full bg-black object-cover"
          />
          <div className="px-3 py-2">
            <p className="hint m-0">
              Asked for each value, then read back what the driver actually set. A value that comes
              back higher than asked is the floor we cannot get under.
            </p>
            {liveLog.map((l, n) => (
              <div key={n} className="flex gap-2 border-b border-line py-1 text-md last:border-b-0">
                <span className="w-[120px] shrink-0 text-ink-2">asked {String(l.asked)}</span>
                <span className="mono">got {l.got}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {raw && (
        <div className="card">
          <div className="grouphead">
            <h2 className="lbl">Send me this</h2>
            <div className="grow" />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => navigator.clipboard?.writeText(raw)}
            >
              Copy
            </button>
          </div>
          <div className="p-3">
            <textarea readOnly value={raw} rows={14} className="input mono w-full text-sm" />
          </div>
        </div>
      )}
    </div>
  );
}
