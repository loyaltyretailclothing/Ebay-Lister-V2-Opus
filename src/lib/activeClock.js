"use client";

// Efficiency Tracker clock: counts ACTIVE time only.
//   - Any quiet gap (no tap, key, scroll or mouse movement) counts at most
//     IDLE_CAP_MS — lining up a shot or reading a tag still counts, walking
//     away doesn't.
//   - Time while the page is hidden (phone locked, app in the background,
//     another browser tab) doesn't count at all.
// take() returns the active time since the last take() and starts over,
// so one clock can time several steps back to back.

export const IDLE_CAP_MS = 30 * 1000;

const EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll", "input"];

export function createActiveClock() {
  let active = 0;
  let last = Date.now();
  let hidden = typeof document !== "undefined" && document.hidden;

  const credit = (now) => {
    if (!hidden) active += Math.min(Math.max(0, now - last), IDLE_CAP_MS);
    last = now;
  };
  const onActivity = () => credit(Date.now());
  const onVisibility = () => {
    const now = Date.now();
    credit(now);
    hidden = document.hidden;
  };

  if (typeof window !== "undefined") {
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", onVisibility);
  }

  return {
    // Active ms so far (doesn't reset).
    read() {
      const now = Date.now();
      const pending = hidden ? 0 : Math.min(Math.max(0, now - last), IDLE_CAP_MS);
      return active + pending;
    },
    // Active ms since the last take(), then start over.
    take() {
      credit(Date.now());
      const ms = active;
      active = 0;
      return ms;
    },
    stop() {
      if (typeof window === "undefined") return;
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
