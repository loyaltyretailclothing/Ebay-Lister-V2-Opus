"use client";

import { useEffect } from "react";

// Drafts waiting on Anthropic's batch queue. Anthropic never calls us back,
// so while the app is open this quietly asks whether any answers are ready
// and fills those drafts in. The morning cron does the same, so nothing is
// stuck if neither of you opens the app — and the answers wait 29 days at
// Anthropic either way, so nothing is ever lost.
//
// Renders nothing; mounted once in the root layout beside PhotoSweeper.
// See docs/Plans/Batch Analysis Plan.md.

const IDLE_MS = 5 * 60 * 1000; // nothing queued — look again later
const BUSY_MS = 2 * 60 * 1000; // something is waiting — check every 2 min

// Only one tab should be asking. Every open tab used to run its own loop, so
// a phone and a desktop each doubled the traffic, and on 2026-10-09 that
// helped exhaust Cloudinary's 500-an-hour limit and took the drafts list and
// photo library down. A timestamp in localStorage is enough: whichever tab
// claims it does the round, the rest skip. If that tab is closed mid-round
// the claim goes stale and the next one picks it up.
const CLAIM_KEY = "lister.batchPoll.claimedAt";
const CLAIM_MS = 45 * 1000; // a round should never take this long

function claim() {
  try {
    const last = Number(localStorage.getItem(CLAIM_KEY) || 0);
    if (Date.now() - last < CLAIM_MS) return false;
    localStorage.setItem(CLAIM_KEY, String(Date.now()));
    return true;
  } catch {
    // Private mode, storage disabled — behave as before rather than stall.
    return true;
  }
}

function release() {
  try {
    localStorage.removeItem(CLAIM_KEY);
  } catch {
    /* nothing to release */
  }
}

export default function BatchCollector() {
  useEffect(() => {
    let timer = null;
    let stopped = false;

    async function collect() {
      timer = null;
      if (stopped) return;
      let wait = IDLE_MS;

      if (claim()) {
        try {
          const data = await fetch("/api/batches/collect", { method: "POST" }).then((r) => r.json());
          // Check often while anything is still in the queue; back off when
          // there's nothing to wait for.
          if (data?.success && (data.waiting > 0 || data.movedToPhase2 > 0)) wait = BUSY_MS;
        } catch {
          // Offline, or the sweep failed — try again on the slow beat.
        } finally {
          release();
        }
      } else {
        // Another tab is on it. Look again soon in case that tab goes away.
        wait = BUSY_MS;
      }

      if (!stopped) timer = setTimeout(collect, wait);
    }

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      collect();
    }

    collect();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
