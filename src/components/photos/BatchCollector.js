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
const BUSY_MS = 60 * 1000; // something is waiting — check every minute

export default function BatchCollector() {
  useEffect(() => {
    let timer = null;
    let stopped = false;

    async function collect() {
      timer = null;
      if (stopped) return;
      let wait = IDLE_MS;
      try {
        const data = await fetch("/api/batches/collect", { method: "POST" }).then((r) => r.json());
        // Check often while anything is still in the queue; back off when
        // there's nothing to wait for.
        if (data?.success && (data.waiting > 0 || data.movedToPhase2 > 0)) wait = BUSY_MS;
      } catch {
        // Offline, or the sweep failed — try again on the slow beat.
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
