// The users' own clock. Times typed into the app — a scheduled listing's
// start time, the 7am posting run — mean the time where they live, not the
// server's. Vercel runs on UTC, so "5:00 pm" read straight off the server
// clock became noon Central; this converts properly and follows daylight
// saving by itself.

export const ZONE = "America/Chicago";

// How far ahead of UTC the zone is at that moment, in milliseconds.
function offsetAt(instant, zone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  // Some engines print midnight as hour 24.
  const hour = get("hour") % 24;
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return asIfUtc - instant.getTime();
}

// "2026-09-28" + "17:00" (in ZONE) → the matching UTC ISO string.
// Returns null if either part is missing or unreadable, so a caller can
// leave the field off rather than send eBay a wrong time.
export function localToUtcIso(date, time = "00:00", zone = ZONE) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return null;
  const hhmm = /^(\d{1,2}):(\d{2})$/.exec(String(time || "").trim());
  if (!hhmm) return null;
  const hours = Number(hhmm[1]);
  const minutes = Number(hhmm[2]);
  if (hours > 23 || minutes > 59) return null;

  // Read the wall-clock time as if it were UTC, then take the zone's offset
  // off it. Done twice because the offset itself can differ either side of a
  // daylight-saving change.
  const naive = new Date(`${date}T${String(hours).padStart(2, "0")}:${hhmm[2]}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;
  let guess = new Date(naive.getTime() - offsetAt(naive, zone));
  guess = new Date(naive.getTime() - offsetAt(guess, zone));
  return guess.toISOString();
}
