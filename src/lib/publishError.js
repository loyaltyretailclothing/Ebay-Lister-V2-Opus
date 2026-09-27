// Why a publish failed, in words.
//
// /api/ebay/list always answers with a sentence in `error`. Anything else —
// a platform timeout, an error page, a gateway — answers in its own shape,
// and putting that straight into a message gives "[object Object]", which is
// what the failed posting morning of 2026-09-27 recorded and why nothing
// could be learned from it. So when the reply isn't ours, describe it from
// the status and the raw body instead.

export function describeFailure(status, data, body) {
  // Our own route: it already says what went wrong.
  if (typeof data?.error === "string" && data.error.trim()) return data.error;

  // Vercel and friends: {"error":{"code":"FUNCTION_INVOCATION_TIMEOUT",…}}
  const code =
    typeof data?.error?.code === "string"
      ? data.error.code
      : typeof data?.error?.message === "string"
        ? data.error.message
        : "";
  const snippet = String(body || "")
    .replace(/<[^>]*>/g, " ") // an error page, stripped to its words
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  const parts = [`HTTP ${status || "no response"}`];
  if (code) parts.push(code);
  else if (snippet) parts.push(snippet);
  return parts.join(" — ");
}

// Read a response without assuming it's JSON, so an error page doesn't turn
// into a parse error that hides what actually happened.
export async function readReply(res) {
  const body = await res.text();
  let data = null;
  try {
    data = JSON.parse(body);
  } catch {
    // Not JSON — describeFailure works from the raw body.
  }
  return { data, body };
}
