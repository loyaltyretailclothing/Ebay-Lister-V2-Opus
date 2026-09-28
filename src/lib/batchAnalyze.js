import client from "./claude";

// Anthropic's batch queue. The same requests the live path sends, posted to
// a queue that answers within the hour as a rule and 24 hours at worst, for
// HALF the price. Nothing here builds a prompt — the prompts live in
// listingPipeline.js and are shared with the live path, so the two can't drift.
//
// A draft goes through two phases, because eBay sits in the middle:
//   phase 1  photos → what is this item? (then we ask eBay what that
//            category's questions are)
//   phase 2  answer eBay's questions
// Each phase is its own batch of ONE request, so a single draft can be pulled
// out ("Analyze now") without disturbing any other.
//
// See docs/Plans/Batch Analysis Plan.md.

// A batch that hasn't answered by this long is treated as lost and the draft
// is run live instead. Anthropic expires them at 24 hours; we give up first
// so a draft is never stuck for a whole day with nothing to show.
export const GIVE_UP_MS = 20 * 60 * 60 * 1000;

// Submit one request. Returns the batch id to write on the draft.
export async function submitOne(params, customId = "job") {
  const batch = await client.messages.batches.create({
    requests: [{ custom_id: String(customId).slice(0, 60), params }],
  });
  return batch.id;
}

// What became of a submitted batch.
//   { state: "waiting" }                       still queued
//   { state: "done", text, usage }             answered
//   { state: "failed", reason }                errored, cancelled or expired
export async function checkOne(batchId) {
  const batch = await client.messages.batches.retrieve(batchId);
  if (batch.processing_status !== "ended") return { state: "waiting" };

  for await (const entry of await client.messages.batches.results(batchId)) {
    const r = entry.result;
    if (r.type === "succeeded") {
      const text = (r.message.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return { state: "done", text, usage: r.message.usage };
    }
    return {
      state: "failed",
      reason:
        r.type === "expired"
          ? "the queue didn't get to it"
          : r.type === "canceled"
            ? "cancelled"
            : r.error?.type || "the queue returned an error",
    };
  }
  // Ended with nothing in it — treat as lost rather than wait forever.
  return { state: "failed", reason: "the queue returned nothing" };
}

// Give up on a batch (used by "Analyze now"). Anthropic doesn't bill a
// request it hadn't started, so pulling a draft out is normally free.
export async function cancelOne(batchId) {
  try {
    await client.messages.batches.cancel(batchId);
  } catch (err) {
    // Already finished or already cancelled — nothing to undo.
    console.error("Couldn't cancel batch:", err?.message || err);
  }
}

// Half price, so what a batched run cost is also what it saved.
export function halveTally(tally) {
  return { ...tally, cost: tally.cost / 2, batch: true };
}
