"use client";

import { useEffect } from "react";

// Held items' photos are deleted half an hour after their listing goes live.
// The server can't count down half an hour on its own (see
// src/lib/photoSweep.js), but an open browser tab has a clock — so while the
// app is open it asks the server what's due, is told when the next lot comes
// due, and wakes up for exactly that minute.
//
// Open the app at 7:05 after a 7:00 posting run and nothing is due yet; the
// page sets itself a timer and deletes them at 7:30 while you're sitting
// there. Close the tab and the next opening (or the daily cron) does it.
// Renders nothing; mounted once in the root layout.

const HEARTBEAT_MS = 15 * 60 * 1000; // nothing due — look again later
const MIN_GAP_MS = 20 * 1000; // never hammer it

export default function PhotoSweeper() {
  useEffect(() => {
    let timer = null;
    let stopped = false;
    let lastRun = 0;

    async function sweep() {
      timer = null;
      if (stopped) return;
      let wait = HEARTBEAT_MS;
      const since = Date.now() - lastRun;
      // A tab sitting in the background still counts as the app being open —
      // browsers keep its timers running (slowed down, which is fine here).
      if (since < MIN_GAP_MS) {
        wait = MIN_GAP_MS - since; // asked again too soon — come straight back
      } else {
        lastRun = Date.now();
        try {
          const data = await fetch("/api/cloudinary/sweep", { method: "POST" }).then((r) =>
            r.json()
          );
          const next = Date.parse(data?.nextDueAt || "");
          // Back a couple of seconds after the next one falls due.
          if (Number.isFinite(next)) {
            wait = Math.min(HEARTBEAT_MS, Math.max(MIN_GAP_MS, next - Date.now() + 2000));
          }
        } catch {
          // Offline or the sweep failed — the heartbeat tries again.
        }
      }
      if (!stopped) timer = setTimeout(sweep, wait);
    }

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      sweep();
    }

    sweep();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
