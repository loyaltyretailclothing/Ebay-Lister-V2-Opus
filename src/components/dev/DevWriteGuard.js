"use client";

// LOCAL TESTING ONLY. Local dev shares the real Cloudinary account, so when
// testing in a browser tab with localStorage "lister.blockWrites" = "1",
// every non-GET request to /api/* is blocked (answered with a fake failure)
// before any page code runs. Compiled out of production builds.
if (
  process.env.NODE_ENV === "development" &&
  typeof window !== "undefined" &&
  !window.__listerWriteGuard
) {
  let on = false;
  try {
    on = window.localStorage.getItem("lister.blockWrites") === "1";
  } catch {}
  if (on) {
    const original = window.fetch;
    window.__listerBlocked = [];
    window.fetch = function guarded(input, init) {
      const method = String(init?.method || input?.method || "GET").toUpperCase();
      const url = String(input?.url || input);
      if (method !== "GET" && url.includes("/api/")) {
        window.__listerBlocked.push(`${method} ${url}`);
        return Promise.resolve(
          new Response(JSON.stringify({ success: false, error: "Blocked (test mode)" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return original.apply(this, arguments);
    };
  }
  window.__listerWriteGuard = true;
}

export default function DevWriteGuard() {
  return null;
}
