"use client";

import { useSyncExternalStore } from "react";

// Big windows (1280px+) get the desktop layout; everything smaller gets the
// phone layout. Measured ONCE per page load and shared by the app chrome and
// every page, so they always agree and nothing flips mid-work if the window
// is resized (refresh to switch). null while the page is hydrating.
let wideAtLoad = null;
function snapshot() {
  if (wideAtLoad === null) wideAtLoad = window.matchMedia("(min-width: 1280px)").matches;
  return wideAtLoad;
}
const subscribe = () => () => {};

export default function useWide() {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
