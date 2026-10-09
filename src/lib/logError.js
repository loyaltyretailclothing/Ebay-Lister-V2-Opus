// Log an error without printing credentials.
//
// The Cloudinary SDK rejects with an object that carries the whole request,
// INCLUDING `request_options.auth` — the API key and secret in plain text.
// Logging that object put the secret into Vercel's runtime logs, found on
// 2026-10-09 while chasing the rate-limit outage.
//
// Use this anywhere a third-party SDK error reaches console.error.
export function safeError(error) {
  if (!error || typeof error !== "object") return String(error ?? "unknown error");

  // Cloudinary's shape: { error: { message, http_code }, request_options }
  const inner = error.error;
  if (inner && typeof inner === "object" && inner.message) {
    const code = inner.http_code ? ` (HTTP ${inner.http_code})` : "";
    return `${inner.message}${code}`;
  }

  if (error.message) return error.message;
  return "unknown error";
}

export function logError(label, error) {
  console.error(`${label}: ${safeError(error)}`);
}
