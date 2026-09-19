// Efficiency Tracker — shared, pure helpers (safe on server and in the
// browser). See docs/Plans/Efficiency Tracker Plan.md.
//
// Two separate trackers, each with its own log entries:
//   camera — camera opens → Create Draft. Logged when the draft is created;
//            the server adds the category once the AI has picked it.
//            { kind:"camera", at (when shot), category, categoryId,
//              shootMs, reviewMs, totalMs, photos, draftId }
//   draft  — draft opened → List on eBay (added up across sittings).
//            Logged when it's listed.
//            { kind:"draft", at (when listed), category, categoryId,
//              finishMs, totalMs, analyses, listingId }
// Times are ACTIVE milliseconds (see lib/activeClock).

const MAX_MS = 24 * 60 * 60 * 1000; // anything above a day is junk

export function cleanMs(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= MAX_MS ? n : 0;
}
function cleanDate(v) {
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}
const cleanInt = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));
const cleanCategory = (v) => String(v || "").slice(0, 120) || "Uncategorized";

// What the camera page sends with Create Draft.
export function cleanCameraTiming(t) {
  if (!t || typeof t !== "object") return null;
  const shootMs = cleanMs(t.shootMs);
  const reviewMs = cleanMs(t.reviewMs);
  if (!shootMs && !reviewMs) return null;
  return { shootMs, reviewMs, photos: cleanInt(t.photos, 99), shotAt: cleanDate(t.shotAt) };
}

export function buildCameraEntry({ timing, draftId, category, categoryId }) {
  const t = cleanCameraTiming(timing);
  if (!t) return null;
  return {
    kind: "camera",
    at: t.shotAt || new Date().toISOString(),
    category: cleanCategory(category),
    categoryId: String(categoryId || "").slice(0, 20),
    shootMs: t.shootMs,
    reviewMs: t.reviewMs,
    totalMs: t.shootMs + t.reviewMs,
    photos: t.photos,
    draftId: String(draftId || "").slice(0, 60),
  };
}

export function buildDraftEntry({ listing, finishMs, analyses, listingId, listedAt }) {
  const finish = cleanMs(finishMs);
  return {
    kind: "draft",
    at: cleanDate(listedAt) || new Date().toISOString(),
    category: cleanCategory(listing?.categoryName),
    categoryId: String(listing?.categoryId || "").slice(0, 20),
    finishMs: finish,
    totalMs: finish,
    analyses: cleanInt(analyses, 99),
    listingId: String(listingId || "").slice(0, 30),
  };
}

// Clean an entry read back from storage (or received by the API).
export function cleanEntry(e) {
  if (!e || typeof e !== "object") return null;
  const at = cleanDate(e.at);
  if (!at) return null;
  const base = {
    at,
    category: cleanCategory(e.category),
    categoryId: String(e.categoryId || "").slice(0, 20),
  };
  if (e.kind === "camera") {
    const shootMs = cleanMs(e.shootMs);
    const reviewMs = cleanMs(e.reviewMs);
    return {
      kind: "camera",
      ...base,
      shootMs,
      reviewMs,
      totalMs: shootMs + reviewMs,
      photos: cleanInt(e.photos, 99),
      draftId: String(e.draftId || "").slice(0, 60),
    };
  }
  if (e.kind === "draft") {
    const finishMs = cleanMs(e.finishMs);
    return {
      kind: "draft",
      ...base,
      finishMs,
      totalMs: finishMs,
      analyses: cleanInt(e.analyses, 99),
      listingId: String(e.listingId || "").slice(0, 30),
    };
  }
  return null;
}

// Stable storage id, so a repeat of the same event overwrites instead of
// double counting (the camera's draft request can be retried by the host).
export function entryId(e) {
  const key = e.kind === "camera" ? e.draftId : e.listingId;
  const safe = String(key || "").replace(/[^A-Za-z0-9_-]/g, "");
  return `${e.kind}_${safe || `${Date.parse(e.at)}_${Math.random().toString(36).slice(2, 8)}`}`;
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

// Typical (median) times for a group of one tracker's entries; outliers
// (over OUTLIER_MS) are counted but left out of the numbers.
export function summarize(entries, partKeys = []) {
  const normal = entries.filter((e) => e.totalMs <= OUTLIER_MS);
  const activeMs = normal.reduce((s, e) => s + e.totalMs, 0);
  return {
    count: entries.length,
    total: median(normal.map((e) => e.totalMs)),
    parts: Object.fromEntries(partKeys.map((k) => [k, median(normal.map((e) => e[k]))])),
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
