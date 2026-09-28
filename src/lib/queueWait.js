// Little words for a draft's place in Anthropic's batch queue. Pure, so the
// drafts list, the desktop panel and the status lanes all say it the same
// way. See docs/Plans/Batch Analysis Plan.md.

// "14 min" / "2 hr 05 min" — how long a queued draft has been waiting.
export function waitedFor(since) {
  const ms = Date.now() - Date.parse(since || "");
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} hr ${String(min % 60).padStart(2, "0")} min`;
}

// How a finished draft got finished. Plain "Ready" when you asked for it —
// you already know. The others say something you'd otherwise never learn:
// it came back from the queue, or the queue let it down and the app re-ran
// it live at full price.
export function readyLabel(readyBy) {
  if (readyBy === "batch") return "Ready by Batch";
  if (readyBy === "force") return "Ready by Force";
  return "Ready";
}
