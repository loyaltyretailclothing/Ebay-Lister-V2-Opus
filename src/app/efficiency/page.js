"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshIcon, Spinner } from "@/components/ui/Icons";
import { OUTLIER_MS, fmtDuration, summarize, weekStart } from "@/lib/efficiency";

// Efficiency Tracker (desktop tab "Track"). How long each listed item took —
// shooting (camera open → Done) + review (Done → Create Draft) + finishing
// (draft open → List on eBay), ACTIVE time only. Total per item is the
// headline. Pick a date range, optionally compare it with another period.
// See docs/Plans/Efficiency Tracker Plan.md.

const DAY = 24 * 60 * 60 * 1000;
const PARTS = [
  { key: "shoot", label: "Shooting", color: "var(--color-accent)" },
  { key: "review", label: "Review", color: "var(--color-warn)" },
  { key: "finish", label: "Finishing", color: "var(--color-ok)" },
];
const CMP_COLOR = "var(--color-ink-3)";

// --- date ranges (local time) ------------------------------------------------
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function mondayOf(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function rangeFor(key, custom) {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY);
  const mon = mondayOf(now);
  const m1 = new Date(now.getFullYear(), now.getMonth(), 1);
  switch (key) {
    case "this-week":
      return { from: mon, to: tomorrow, label: "This week" };
    case "last-week":
      return { from: new Date(mon.getTime() - 7 * DAY), to: mon, label: "Last week" };
    case "this-month":
      return { from: m1, to: tomorrow, label: "This month" };
    case "last-month":
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: m1, label: "Last month" };
    case "last-30":
      return { from: new Date(today.getTime() - 29 * DAY), to: tomorrow, label: "Last 30 days" };
    case "custom": {
      const from = custom?.from ? startOfDay(new Date(`${custom.from}T00:00`)) : today;
      const to = custom?.to ? new Date(startOfDay(new Date(`${custom.to}T00:00`)).getTime() + DAY) : tomorrow;
      return { from, to, label: "Custom" };
    }
    default:
      return { from: new Date(0), to: new Date(8.64e15), label: "All time" };
  }
}
// The period just before a range (this week → last week, this month → last month).
function previousOf(key, r) {
  if (key === "this-week") return rangeFor("last-week");
  if (key === "this-month") return rangeFor("last-month");
  if (key === "last-week") return { from: new Date(r.from.getTime() - 7 * DAY), to: r.from, label: "Week before" };
  if (key === "last-month") {
    const f = r.from;
    return { from: new Date(f.getFullYear(), f.getMonth() - 1, 1), to: f, label: "Month before" };
  }
  const len = r.to - r.from;
  return { from: new Date(r.from.getTime() - len), to: r.from, label: "Previous period" };
}
const inRange = (e, r) => {
  const t = Date.parse(e.listedAt);
  return t >= r.from.getTime() && t < r.to.getTime();
};
const fmtDay = (d) => d.toLocaleDateString([], { month: "short", day: "numeric" });

const RANGES = [
  ["this-week", "This week"],
  ["last-week", "Last week"],
  ["this-month", "This month"],
  ["last-month", "Last month"],
  ["last-30", "Last 30 days"],
  ["all", "All time"],
  ["custom", "Custom"],
];

// "16% faster" / "8% slower" — lower time is better.
function change(before, after) {
  if (!before || after === null || after === undefined) return null;
  const pct = Math.round(((before - after) / before) * 100);
  if (pct === 0) return { text: "same", good: null };
  return pct > 0 ? { text: `${pct}% faster`, good: true } : { text: `${-pct}% slower`, good: false };
}

export default function EfficiencyPage() {
  const [entries, setEntries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState("this-month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [compare, setCompare] = useState("none"); // none | previous | a RANGES key

  async function load() {
    try {
      const res = await fetch("/api/efficiency", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Couldn't load the log");
      setEntries(data.entries || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const range = useMemo(() => rangeFor(rangeKey, custom), [rangeKey, custom]);
  const cmpRange = useMemo(() => {
    if (compare === "none") return null;
    if (compare === "previous") return previousOf(rangeKey, range);
    return rangeFor(compare, custom);
  }, [compare, rangeKey, range, custom]);

  const all = useMemo(() => entries || [], [entries]);
  const cur = useMemo(() => all.filter((e) => inRange(e, range)), [all, range]);
  const prev = useMemo(() => (cmpRange ? all.filter((e) => inRange(e, cmpRange)) : []), [all, cmpRange]);
  const S = useMemo(() => summarize(cur), [cur]);
  const P = useMemo(() => (cmpRange ? summarize(prev) : null), [prev, cmpRange]);

  // Weekly trend: the last 12 weeks (always), so improvement is visible.
  const weeks = useMemo(() => {
    const start = mondayOf(new Date(Date.now() - 11 * 7 * DAY));
    const keys = [];
    for (let i = 0; i < 12; i++) keys.push(weekStart(new Date(start.getTime() + i * 7 * DAY).toISOString()));
    const by = Object.fromEntries(keys.map((k) => [k, []]));
    for (const e of all) {
      const k = weekStart(e.listedAt);
      if (by[k]) by[k].push(e);
    }
    return keys.map((k) => ({ key: k, ...summarize(by[k]) }));
  }, [all]);

  // By category, for the range (and compare range).
  const categories = useMemo(() => {
    const names = new Set([...cur, ...prev].map((e) => e.category));
    return [...names]
      .map((name) => ({
        name,
        cur: summarize(cur.filter((e) => e.category === name)),
        prev: cmpRange ? summarize(prev.filter((e) => e.category === name)) : null,
      }))
      .filter((c) => c.cur.count > 0 || (c.prev && c.prev.count > 0))
      .sort((a, b) => b.cur.count - a.cur.count);
  }, [cur, prev, cmpRange]);

  const outliers = cur.filter((e) => e.totalMs > OUTLIER_MS);
  const finishOnly = cur.filter((e) => !e.cameraTimed).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-13 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
        <h1 className="m-0 whitespace-nowrap text-xl font-semibold tracking-[-0.01em]">Efficiency Tracker</h1>
        <span className="text-sm text-ink-3">Active time per listed item</span>
        <div className="grow" />
        <button type="button" className="btn btn-sm" onClick={() => { setLoading(true); load(); }} disabled={loading}>
          {loading ? <Spinner className="size-3.5" /> : <RefreshIcon className="size-3.5" />}
          Refresh
        </button>
      </header>

      {error && (
        <div className="lane lane-bad shrink-0">
          <p>{error}</p>
        </div>
      )}

      <div className="min-h-0 grow overflow-y-auto bg-panel">
        {/* Range + compare */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          {RANGES.map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={rangeKey === k}
              onClick={() => setRangeKey(k)}
              className={`btn btn-sm rounded-full ${rangeKey === k ? "border-accent-line bg-accent-weak text-accent" : ""}`}
            >
              {label}
            </button>
          ))}
          {rangeKey === "custom" && (
            <span className="flex items-center gap-1.5 text-sm">
              <input type="date" className="input h-8 w-[140px]" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              to
              <input type="date" className="input h-8 w-[140px]" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </span>
          )}
          <div className="grow" />
          <label className="flex items-center gap-2 text-sm text-ink-2">
            Compare with
            <select className="select h-8 w-[170px]" value={compare} onChange={(e) => setCompare(e.target.value)}>
              <option value="none">Nothing</option>
              <option value="previous">Previous period</option>
              {RANGES.filter(([k]) => k !== "custom" && k !== "all").map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && !entries ? (
          <div className="flex items-center justify-center gap-2 p-16 text-ink-2">
            <Spinner className="size-4" /> Loading the log…
          </div>
        ) : (
          <>
            <p className="m-0 px-4 pt-3 text-sm text-ink-3">
              {fmtDay(range.from)} – {fmtDay(new Date(Math.min(range.to.getTime(), Date.now() + DAY) - DAY))}
              {range.label === "All time" ? " (all time)" : ""}
              {cmpRange ? ` · compared with ${fmtDay(cmpRange.from)} – ${fmtDay(new Date(cmpRange.to.getTime() - DAY))}` : ""}
            </p>

            {/* Headline */}
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-3 px-4 pt-3">
              <Stat big label="Total per item" value={fmtDuration(S.total)} cmp={P && fmtDuration(P.total)} delta={P && change(P.total, S.total)} />
              <Stat label="Shooting" value={fmtDuration(S.shoot)} cmp={P && fmtDuration(P.shoot)} delta={P && change(P.shoot, S.shoot)} />
              <Stat label="Review" value={fmtDuration(S.review)} cmp={P && fmtDuration(P.review)} delta={P && change(P.review, S.review)} />
              <Stat label="Finishing" value={fmtDuration(S.finish)} cmp={P && fmtDuration(P.finish)} delta={P && change(P.finish, S.finish)} />
              <Stat
                label="Items listed"
                value={S.count}
                sub={S.perHour ? `${S.perHour.toFixed(1)} per active hour` : ""}
                cmp={P && String(P.count)}
              />
            </div>
            <p className="m-0 px-4 pt-2 text-sm text-ink-3">
              Typical (median) times. Totals use items that went through the camera
              {finishOnly ? ` — ${finishOnly} finishing-only item${finishOnly === 1 ? "" : "s"} left out of totals` : ""}.
              {S.outliers ? ` ${S.outliers} outlier${S.outliers === 1 ? "" : "s"} (over ${OUTLIER_MS / 60000} min) left out.` : ""}
            </p>

            {all.length === 0 ? (
              <div className="m-4 rounded-panel border border-dashed border-line-strong p-8 text-center text-ink-2">
                Nothing logged yet. Every item listed from now on is timed automatically — check back after a few days.
              </div>
            ) : (
              <>
                {/* Graphs */}
                <div className="grid grid-cols-2 gap-4 px-4 pt-5">
                  <Card title="Total per item, week by week" sub="Last 12 weeks · typical (median) · lower is better">
                    <LineChart weeks={weeks} />
                  </Card>
                  <Card title="Where the time goes" sub="Last 12 weeks · shooting · review · finishing">
                    <StackedBars weeks={weeks} />
                  </Card>
                </div>
                <div className="px-4 pt-4">
                  <Card
                    title="Total per item by category"
                    sub={cmpRange ? `${range.label} vs ${cmpRange.label.toLowerCase()}` : range.label}
                  >
                    <CategoryBars categories={categories} compare={!!cmpRange} />
                  </Card>
                </div>

                {/* Table */}
                <div className="px-4 pb-2 pt-5">
                  <h2 className="lbl mb-2">By category</h2>
                  <table className="w-full table-fixed border-collapse text-md">
                    <thead>
                      <tr className="border-b border-line text-left text-sm text-ink-3">
                        <th className="py-2 font-medium">Category</th>
                        <th className="w-[70px] py-2 pr-3 text-right font-medium">Items</th>
                        <th className="w-[120px] py-2 pr-3 text-right font-medium text-ink">Total per item</th>
                        <th className="w-[230px] py-2 pr-3 text-right font-medium">Shooting · Review · Finishing</th>
                        {cmpRange && <th className="w-[200px] py-2 text-right font-medium">vs {cmpRange.label.toLowerCase()}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((c) => {
                        const d = c.prev ? change(c.prev.total, c.cur.total) : null;
                        return (
                          <tr key={c.name} className="border-b border-line">
                            <td className="truncate py-2" title={c.name}>{c.name}</td>
                            <td className="py-2 pr-3 text-right">{c.cur.count}</td>
                            <td className="py-2 pr-3 text-right font-semibold">{fmtDuration(c.cur.total)}</td>
                            <td className="py-2 pr-3 text-right text-ink-2">
                              {fmtDuration(c.cur.shoot)} · {fmtDuration(c.cur.review)} · {fmtDuration(c.cur.finish)}
                            </td>
                            {cmpRange && (
                              <td className="py-2 text-right text-ink-2">
                                {fmtDuration(c.prev?.total)}
                                {d && <span className={`ml-2 font-semibold ${d.good ? "text-ok" : d.good === false ? "text-bad" : ""}`}>{d.text}</span>}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {categories.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-ink-3">Nothing listed in this date range.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {outliers.length > 0 && (
                  <div className="px-4 pb-6 pt-4">
                    <h2 className="lbl mb-2">Outliers (over {OUTLIER_MS / 60000} min active — not in the numbers above)</h2>
                    <ul className="m-0 list-none p-0 text-md">
                      {outliers.map((e, i) => (
                        <li key={i} className="flex gap-3 border-b border-line py-1.5">
                          <span className="w-[90px] text-ink-3">{fmtDay(new Date(e.listedAt))}</span>
                          <span className="grow truncate">{e.category}</span>
                          <span className="font-semibold">{fmtDuration(e.totalMs)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, cmp, delta, big }) {
  return (
    <div className={`rounded-panel px-3.5 py-2.5 ${big ? "border border-accent-line bg-accent-weak" : "bg-sunken"}`}>
      <div className={`text-sm ${big ? "font-semibold text-accent" : "text-ink-2"}`}>{label}</div>
      <div className={`font-semibold ${big ? "text-[30px] leading-9" : "text-[22px] leading-7"}`}>{value}</div>
      {cmp !== undefined && cmp !== null && cmp !== false && (
        <div className="text-sm text-ink-3">
          was {cmp}
          {delta && <span className={`ml-1.5 font-semibold ${delta.good ? "text-ok" : delta.good === false ? "text-bad" : ""}`}>{delta.text}</span>}
        </div>
      )}
      {sub && <div className="text-sm text-ink-3">{sub}</div>}
    </div>
  );
}

function Card({ title, sub, children }) {
  return (
    <div className="rounded-panel border border-line p-3.5">
      <div className="text-md font-semibold">{title}</div>
      <div className="mb-2 text-sm text-ink-3">{sub}</div>
      {children}
    </div>
  );
}

// --- graphs (plain SVG; hover a point/bar for its numbers) -------------------
const W = 520;
const H = 190;
const PAD = { l: 40, r: 10, t: 10, b: 26 };
// Axis labels: "10m", "2m 30s", "45s".
function fmtAxis(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return s % 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s / 60}m`;
}
const weekLabel = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return fmtDay(new Date(y, m - 1, d));
};
function niceMax(ms) {
  const min = Math.max(ms, 60000);
  const step = min <= 5 * 60000 ? 60000 : min <= 20 * 60000 ? 5 * 60000 : 10 * 60000;
  return Math.ceil(min / step) * step;
}
function YAxis({ max }) {
  const ticks = [0, max / 2, max];
  return ticks.map((t) => {
    const y = PAD.t + (1 - t / max) * (H - PAD.t - PAD.b);
    return (
      <g key={t}>
        <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--color-line)" />
        <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-3)">
          {fmtAxis(t)}
        </text>
      </g>
    );
  });
}
function XLabels({ weeks, x }) {
  return weeks.map((w, i) =>
    i % 2 === 0 ? (
      <text key={w.key} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-3)">
        {weekLabel(w.key)}
      </text>
    ) : null
  );
}

function LineChart({ weeks }) {
  const max = niceMax(Math.max(0, ...weeks.map((w) => w.total || 0)));
  const x = (i) => PAD.l + (i + 0.5) * ((W - PAD.l - PAD.r) / weeks.length);
  const y = (v) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const pts = weeks.map((w, i) => (w.total === null ? null : [x(i), y(w.total), w]));
  const path = pts
    .filter(Boolean)
    .map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Total time per item by week">
      <YAxis max={max} />
      <XLabels weeks={weeks} x={x} />
      {path && <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" />}
      {pts.filter(Boolean).map(([px, py, w]) => (
        <circle key={w.key} cx={px} cy={py} r="4.5" fill="var(--color-panel)" stroke="var(--color-accent)" strokeWidth="2.5">
          <title>{`Week of ${weekLabel(w.key)}: ${fmtDuration(w.total)} per item (${w.camCount} items)`}</title>
        </circle>
      ))}
    </svg>
  );
}

function StackedBars({ weeks }) {
  const sum = (w) => (w.shoot || 0) + (w.review || 0) + (w.finish || 0);
  const max = niceMax(Math.max(0, ...weeks.map(sum)));
  const slot = (W - PAD.l - PAD.r) / weeks.length;
  const x = (i) => PAD.l + (i + 0.5) * slot;
  const h = (v) => (v / max) * (H - PAD.t - PAD.b);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Shooting, review and finishing time by week">
        <YAxis max={max} />
        <XLabels weeks={weeks} x={x} />
        {weeks.map((w, i) => {
          let base = H - PAD.b;
          return (
            <g key={w.key}>
              <title>{`Week of ${weekLabel(w.key)}: shooting ${fmtDuration(w.shoot)} · review ${fmtDuration(w.review)} · finishing ${fmtDuration(w.finish)}`}</title>
              {PARTS.map((p) => {
                const v = w[p.key] || 0;
                const hh = h(v);
                base -= hh;
                return hh > 0 ? <rect key={p.key} x={x(i) - slot * 0.3} y={base} width={slot * 0.6} height={hh} fill={p.color} rx="1.5" /> : null;
              })}
            </g>
          );
        })}
      </svg>
      <Legend items={PARTS} />
    </div>
  );
}

function CategoryBars({ categories, compare }) {
  const rows = categories.slice(0, 12);
  if (!rows.length) return <p className="m-0 py-6 text-center text-sm text-ink-3">Nothing listed in this date range.</p>;
  const max = niceMax(Math.max(0, ...rows.flatMap((c) => [c.cur.total || 0, c.prev?.total || 0])));
  const labelW = 190;
  const barH = compare ? 9 : 14;
  const rowH = compare ? 30 : 24;
  const width = 1040;
  const height = rows.length * rowH + 22;
  const bw = (v) => ((v || 0) / max) * (width - labelW - 80);
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" role="img" aria-label="Total time per item by category">
        {rows.map((c, i) => {
          const y = i * rowH + 4;
          return (
            <g key={c.name}>
              <text x={labelW - 8} y={y + (compare ? 14 : 12)} textAnchor="end" fontSize="12" fill="var(--color-ink)">
                {c.name.length > 26 ? `${c.name.slice(0, 25)}…` : c.name}
              </text>
              <rect x={labelW} y={y + 1} width={bw(c.cur.total)} height={barH} rx="2" fill="var(--color-accent)">
                <title>{`${c.name}: ${fmtDuration(c.cur.total)} per item (${c.cur.count} items)`}</title>
              </rect>
              <text x={labelW + bw(c.cur.total) + 6} y={y + barH} fontSize="11" fill="var(--color-ink-2)">
                {fmtDuration(c.cur.total)}
              </text>
              {compare && (
                <>
                  <rect x={labelW} y={y + barH + 3} width={bw(c.prev?.total)} height={barH} rx="2" fill={CMP_COLOR}>
                    <title>{`${c.name}, compared period: ${fmtDuration(c.prev?.total)} per item`}</title>
                  </rect>
                  <text x={labelW + bw(c.prev?.total) + 6} y={y + barH * 2 + 3} fontSize="11" fill="var(--color-ink-3)">
                    {fmtDuration(c.prev?.total)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      {compare && (
        <Legend
          items={[
            { key: "a", label: "Selected range", color: "var(--color-accent)" },
            { key: "b", label: "Compared period", color: CMP_COLOR },
          ]}
        />
      )}
    </div>
  );
}

function Legend({ items }) {
  return (
    <div className="mt-1 flex gap-4 text-sm text-ink-2">
      {items.map((p) => (
        <span key={p.key} className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: p.color }} />
          {p.label}
        </span>
      ))}
    </div>
  );
}
