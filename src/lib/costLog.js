import { buildAiEntry } from "./efficiency";
import { writeEntry } from "./efficiencyLog";

// Writing down what an AI run cost. Every Anthropic reply already carries
// its own token counts — free, no extra call — and until now the app printed
// them to a server log nobody reads and threw them away. Saved as an
// ordinary efficiency-log entry (kind "ai"), so the tracker reads cost and
// time from the same place with the same date range.
//
// Always best-effort: bookkeeping must never break a listing or a draft.
export async function logAiCost(tally, { source, draftId, category, categoryId } = {}) {
  try {
    const entry = buildAiEntry({ tally, source, draftId, category, categoryId });
    if (entry) await writeEntry(entry);
  } catch (err) {
    console.error("AI cost log failed:", err);
  }
}
