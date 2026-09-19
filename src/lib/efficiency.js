// Efficiency Tracker — shared, pure helpers (safe on server and in the
// browser). See docs/Plans/Efficiency Tracker Plan.md.
//
// One log entry per LISTED item:
//   { listedAt, shotAt, category, categoryId, shootMs, reviewMs, finishMs,
//     totalMs, photos, analyses, cameraTimed, listingId }
// Times are ACTIVE milliseconds (see lib/activeClock). totalMs is the sum of
// the parts; cameraTimed is false when the item never went through the
// camera (library photos, or drafts made before the tracker existed), so
// its total is finishing-only and is kept out of the totals comparison.

const MAX_MS = 24 * 60 * 60 * 1000; // anything above a day is junk

export function cleanMs(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= MAX_MS ? n : 0;
}

function cleanDate(v) {
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}

// The camera's timing as stored on a draft (listing.timing).
export function cleanCameraTiming(t) {
  if (!t || typeof t !== "object") return null;
  return {
    shootMs: cleanMs(t.shootMs),
    reviewMs: cleanMs(t.reviewMs),
    photos: Math.max(0, Math.min(99, parseInt(t.photos, 10) || 0)),
    shotAt: cleanDate(t.shotAt),
  };
}

// Build a log entry from a listing that was just listed.
export function buildEntry({ listing, finishMs, analyses, listingId, listedAt }) {
  const cam = cleanCameraTiming(listing?.timing);
  const cameraTimed = !!(cam && (cam.shootMs > 0 || cam.reviewMs > 0));
  const shootMs = cameraTimed ? cam.shootMs : 0;
  const reviewMs = cameraTimed ? cam.reviewMs : 0;
  const finish = cleanMs(finishMs);
  return {
    listedAt: cleanDate(listedAt) || new Date().toISOString(),
    shotAt: cameraTimed ? cam.shotAt : "",
    category: String(listing?.categoryName || "Uncategorized").slice(0, 120),
    categoryId: String(listing?.categoryId || "").slice(0, 20),
    shootMs,
    reviewMs,
    finishMs: finish,
    totalMs: shootMs + reviewMs + finish,
    photos: cameraTimed ? cam.photos : 0,
    analyses: Math.max(0, Math.min(99, parseInt(analyses, 10) || 0)),
    cameraTimed,
    listingId: String(listingId || "").slice(0, 30),
  };
}

// Clean an entry read back from storage (or received by the API).
export function cleanEntry(e) {
  if (!e || typeof e !== "object") return null;
  const shootMs = cleanMs(e.shootMs);
  const reviewMs = cleanMs(e.reviewMs);
  const finishMs = cleanMs(e.finishMs);
  const listedAt = cleanDate(e.listedAt);
  if (!listedAt) return null;
  return {
    listedAt,
    shotAt: cleanDate(e.shotAt),
    category: String(e.category || "Uncategorized").slice(0, 120),
    categoryId: String(e.categoryId || "").slice(0, 20),
    shootMs,
    reviewMs,
    finishMs,
    totalMs: shootMs + reviewMs + finishMs,
    photos: Math.max(0, Math.min(99, parseInt(e.photos, 10) || 0)),
    analyses: Math.max(0, Math.min(99, parseInt(e.analyses, 10) || 0)),
    cameraTimed: e.cameraTimed === true || e.cameraTimed === "true",
    listingId: String(e.listingId || "").slice(0, 30),
  };
}

// --- report math -------------------------------------------------------------

export const OUTLIER_MS = 20 * 60 * 1000; // over 20 min active = flagged

export function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

// "4m 05s" / "45s" / "1h 02m"
export function fmtDuration(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

// Typical (median) times for a group of entries. Outliers are left out;
// totals only use camera-timed items (finishing-only totals would look
// faster than they really are).
export function summarize(entries) {
  const normal = entries.filter((e) => e.totalMs <= OUTLIER_MS);
  const cam = normal.filter((e) => e.cameraTimed);
  const activeMs = normal.reduce((s, e) => s + e.totalMs, 0);
  return {
    count: entries.length,
    camCount: cam.length,
    total: median(cam.map((e) => e.totalMs)),
    shoot: median(cam.map((e) => e.shootMs)),
    review: median(cam.map((e) => e.reviewMs)),
    finish: median(normal.map((e) => e.finishMs)),
    perHour: activeMs > 0 ? (normal.length / activeMs) * 3600000 : null,
    outliers: entries.length - normal.length,
  };
}

// Monday-start week key "2026-09-14" for a date (local time).
export function weekStart(iso) {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
