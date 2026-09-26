"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshIcon, SearchIcon, Spinner } from "@/components/ui/Icons";

// Listed — every item that reached eBay, with what it cost and where it came
// from (held items), for filling in Flipwise. Records are written at posting
// time and outlive the draft. See docs/Plans/Listed Report Plan.md.

const DAY = 24 * 60 * 60 * 1000;
const money = (n) =>
  n === null || n === undefined ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function rangeFor(key, custom, now) {
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY);
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const m1 = new Date(today.getFullYear(), today.getMonth(), 1);
  switch (key) {
    case "this-week":
      return { from: mon, to: tomorrow };
    case "last-week":
      return { from: new Date(mon.getTime() - 7 * DAY), to: mon };
    case "this-month":
      return { from: m1, to: tomorrow };
    case "last-month":
      return { from: new Date(today.getFullYear(), today.getMonth() - 1, 1), to: m1 };
    case "last-30":
      return { from: new Date(today.getTime() - 29 * DAY), to: tomorrow };
    case "custom":
      return {
        from: custom.from ? startOfDay(new Date(`${custom.from}T00:00`)) : new Date(0),
        to: custom.to ? new Date(startOfDay(new Date(`${custom.to}T00:00`)).getTime() + DAY) : tomorrow,
      };
    default:
      return { from: new Date(0), to: new Date(8.64e15) };
  }
}
const RANGES = [
  ["this-week", "This week"],
  ["last-week", "Last week"],
  ["this-month", "This month"],
  ["last-month", "Last month"],
  ["last-30", "Last 30 days"],
  ["all", "All time"],
  ["custom", "Custom"],
];

export default function ListedPage() {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState("this-week");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [query, setQuery] = useState("");
  const [openedAt] = useState(() => Date.now());

  async function load() {
    try {
      const data = await fetch("/api/listed", { cache: "no-store" }).then((r) => r.json());
      if (!data.success) throw new Error(data.error || "Couldn't load the report");
      setItems(data.items || []);
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

  const range = useMemo(() => rangeFor(rangeKey, custom, new Date(openedAt)), [rangeKey, custom, openedAt]);
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const all = items || [];
    return all.filter((it) => {
      const t = Date.parse(it.at);
      if (t < range.from.getTime() || t >= range.to.getTime()) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        it.sku.toLowerCase().includes(q) ||
        it.place.toLowerCase().includes(q)
      );
    });
  }, [items, range, q]);

  const spend = rows.reduce((s, it) => s + (it.cost || 0), 0);
  const withCost = rows.filter((it) => it.cost !== null).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-13 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
        <h1 className="m-0 whitespace-nowrap text-xl font-semibold tracking-[-0.01em]">Listed</h1>
        <span className="text-sm text-ink-3">Everything posted to eBay, with cost and where it came from</span>
        <div className="grow" />
        <span className="text-md">
          <b>{rows.length}</b> listed · <b>{money(spend)}</b> spent
        </span>
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

      <div className="min-h-0 grow overflow-y-auto bg-panel p-4">
        <div className="flex flex-wrap items-center gap-2">
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
          <span className="relative flex min-w-[240px] grow items-center">
            <SearchIcon className="pointer-events-none absolute left-2.5 size-3.5 text-ink-3" />
            <input
              type="search"
              className="input h-9 w-full pl-8"
              placeholder="Search by title, SKU or place"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </span>
        </div>

        {loading && !items ? (
          <div className="flex items-center justify-center gap-2 p-16 text-ink-2">
            <Spinner className="size-4" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-4 rounded-panel border border-dashed border-line-strong p-8 text-center text-ink-2">
            {items?.length
              ? "Nothing listed in this range."
              : "Nothing recorded yet. Every item listed from now on lands here — cost and place come from the Hold popup."}
          </p>
        ) : (
          <>
            <p className="m-0 pt-3 text-sm text-ink-3">
              {withCost} of {rows.length} have a cost (items listed straight away don&apos;t carry one).
            </p>
            <table className="mt-2 w-full table-fixed border-collapse text-md">
              <thead>
                <tr className="border-b border-line text-left text-sm text-ink-3">
                  <th className="w-[60px] py-2 font-medium" />
                  <th className="py-2 pr-3 font-medium">Title</th>
                  <th className="w-[110px] py-2 pr-3 font-medium">SKU</th>
                  <th className="w-[190px] py-2 pr-3 font-medium">Place of purchase</th>
                  <th className="w-[90px] py-2 pr-3 text-right font-medium">Cost</th>
                  <th className="w-[110px] py-2 pr-3 font-medium">Listed</th>
                  <th className="w-[80px] py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((it) => (
                  <tr key={it.listingId} className="border-b border-line">
                    <td className="py-1.5">
                      {it.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image} alt="" loading="lazy" className="size-10 rounded-bar border border-line object-cover" />
                      ) : (
                        <div className="size-10 rounded-bar border border-line bg-sunken" />
                      )}
                    </td>
                    <td className="truncate py-1.5 pr-3" title={it.title}>
                      {it.title}
                      {it.held && <span className="badge ml-2">held</span>}
                    </td>
                    <td className="mono py-1.5 pr-3 text-sm">{it.sku || "—"}</td>
                    <td className="truncate py-1.5 pr-3" title={it.place}>{it.place || "—"}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold">{money(it.cost)}</td>
                    <td className="py-1.5 pr-3 text-ink-2">
                      {new Date(it.at).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </td>
                    <td className="py-1.5">
                      <a href={it.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                        eBay
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
