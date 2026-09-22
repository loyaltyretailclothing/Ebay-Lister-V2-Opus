"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  RefreshIcon,
  SearchIcon,
  Spinner,
} from "@/components/ui/Icons";
import { SEASONS, daysUntil, fmtHoldDate, nextSeasonDate, ymd } from "@/lib/seasons";

// On Hold — finished drafts waiting for their season. The app posts them at
// 7am Central on their day. Built for hundreds of items: season cards up
// top, a month calendar for every other date, and one list underneath.
// See docs/Plans/Seasonal Hold Plan.md.

const money = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function OnHoldPage() {
  const [drafts, setDrafts] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [pickedDate, setPickedDate] = useState(""); // which day's list is open
  const [monthAt, setMonthAt] = useState(() => new Date());
  const [chosen, setChosen] = useState(() => new Set()); // bulk selection
  const [busy, setBusy] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [calOpen, setCalOpen] = useState(false);

  async function load() {
    try {
      const [d, r] = await Promise.all([
        fetch("/api/drafts", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/hold-runs", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
      ]);
      if (!d.success) throw new Error(d.error || "Couldn't load drafts");
      setDrafts((d.drafts || []).filter((x) => x.holdUntil));
      if (r?.success) setRuns(r.runs || []);
      setChosen(new Set());
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

  const held = useMemo(() => drafts || [], [drafts]);
  const total = held.reduce((s, d) => s + (d.price || 0), 0);

  // date → { items, value }
  const byDate = useMemo(() => {
    const map = new Map();
    for (const d of held) {
      if (!map.has(d.holdUntil)) map.set(d.holdUntil, { items: [], value: 0 });
      const g = map.get(d.holdUntil);
      g.items.push(d);
      g.value += d.price || 0;
    }
    return map;
  }, [held]);

  // The four presets get a card each (even when empty); everything else is
  // on the calendar — no card for a stray day with one item.
  const seasonCards = useMemo(
    () =>
      SEASONS.map((s) => {
        const date = ymd(nextSeasonDate(s));
        const g = byDate.get(date);
        return { key: s.key, label: s.label, covers: s.covers, date, items: g?.items.length || 0, value: g?.value || 0 };
      }),
    [byDate]
  );
  const presetDates = useMemo(() => new Set(seasonCards.map((c) => c.date)), [seasonCards]);
  const otherDates = [...byDate.entries()].filter(([date]) => !presetDates.has(date));
  const otherCount = otherDates.reduce((s, [, g]) => s + g.items.length, 0);
  const otherValue = otherDates.reduce((s, [, g]) => s + g.value, 0);

  // What the list underneath shows: search results, or the picked day.
  const q = query.trim().toLowerCase();
  const listed = useMemo(() => {
    if (q) {
      return held.filter(
        (d) => d.title?.toLowerCase().includes(q) || d.sku?.toLowerCase().includes(q)
      );
    }
    if (pickedDate) return byDate.get(pickedDate)?.items || [];
    return [];
  }, [q, held, pickedDate, byDate]);

  // Calendar grid for the month on screen (Monday first).
  const cal = useMemo(() => {
    const first = new Date(monthAt.getFullYear(), monthAt.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const weeks = [];
    for (let w = 0; w < 6; w++) {
      const row = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + w * 7 + i);
        const key = ymd(day);
        row.push({
          key,
          day: day.getDate(),
          thisMonth: day.getMonth() === monthAt.getMonth(),
          count: byDate.get(key)?.items.length || 0,
          value: byDate.get(key)?.value || 0,
          isPreset: presetDates.has(key),
        });
      }
      weeks.push(row);
    }
    return weeks;
  }, [monthAt, byDate, presetDates]);

  async function patchHold(ids, date, season) {
    setBusy(true);
    try {
      for (const id of ids) {
        const res = await fetch(`/api/drafts/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holdUntil: date, holdSeason: season || "" }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Couldn't change the hold");
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const lastRun = runs[0];
  const monthLabel = monthAt.toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-13 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
        <h1 className="m-0 whitespace-nowrap text-xl font-semibold tracking-[-0.01em]">On Hold</h1>
        <span className="text-sm text-ink-3">Posts itself at 7am Central on its day</span>
        <div className="grow" />
        {drafts && (
          <span className="text-md">
            <b>{held.length}</b> on hold · <b>{money(total)}</b>
          </span>
        )}
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
        {lastRun && (
          <div className={`lane ${lastRun.failed ? "lane-warn" : "lane-ok"} mb-4 rounded-panel`}>
            <p>
              Last posting morning (
              {new Date(lastRun.at).toLocaleDateString([], { month: "short", day: "numeric" })}):{" "}
              <b>{lastRun.posted}</b> listed · {money(lastRun.value)}
              {lastRun.failed
                ? ` · ${lastRun.failed} couldn't post (back in your drafts): ${lastRun.problems}`
                : ""}
            </p>
          </div>
        )}

        {loading && !drafts ? (
          <div className="flex items-center justify-center gap-2 p-16 text-ink-2">
            <Spinner className="size-4" /> Loading…
          </div>
        ) : (
          <div>
            <div>
              <div className={`grid gap-3 ${otherCount > 0 ? "grid-cols-5" : "grid-cols-4"}`}>
                {seasonCards.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setPickedDate(pickedDate === c.date ? "" : c.date);
                    }}
                    className={`cursor-pointer rounded-panel border px-3.5 py-2.5 text-left ${
                      pickedDate === c.date && !q
                        ? "border-accent-line bg-accent-weak"
                        : "border-line bg-transparent hover:bg-panel-2"
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <b className="text-lg">{c.label}</b>
                      <span className="text-sm text-ink-3">{fmtHoldDate(c.date)}</span>
                    </div>
                    <div className="mt-0.5 text-md">
                      <b>{c.items}</b> item{c.items === 1 ? "" : "s"} · {money(c.value)}
                    </div>
                    <div className="truncate text-sm text-ink-3" title={c.covers}>
                      {daysUntil(c.date)} days · {c.covers}
                    </div>
                  </button>
                ))}
                {otherCount > 0 && (
                  <div className="rounded-panel border border-dashed border-line-strong px-3.5 py-2.5">
                    <b className="text-lg">Other dates</b>
                    <div className="mt-0.5 text-md">
                      <b>{otherCount}</b> item{otherCount === 1 ? "" : "s"} · {money(otherValue)}
                    </div>
                    <div className="text-sm text-ink-3">
                      across {otherDates.length} day{otherDates.length === 1 ? "" : "s"} — pick one on the calendar
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="relative flex grow items-center">
                  <SearchIcon className="pointer-events-none absolute left-2.5 size-3.5 text-ink-3" />
                  <input
                    type="search"
                    className="input h-9 w-full pl-8"
                    placeholder="Search held items by title or SKU"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </span>
                <button type="button" className="btn btn-sm" onClick={() => setCalOpen(true)}>
                  <ClockIcon className="size-3.5" />
                  Calendar
                </button>
                {(q || pickedDate) && (
                  <button type="button" className="btn btn-sm" onClick={() => { setQuery(""); setPickedDate(""); }}>
                    Clear
                  </button>
                )}
              </div>

              {chosen.size > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-panel border border-accent-line bg-accent-weak px-3 py-2">
                  <b>{chosen.size} selected</b>
                  <div className="grow" />
                  <input
                    type="date"
                    className="input h-8 w-[150px]"
                    value={moveTo}
                    onChange={(e) => setMoveTo(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy || !moveTo}
                    onClick={() => patchHold([...chosen], moveTo, "Custom")}
                  >
                    Move to this date
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={() => patchHold([...chosen], ymd(new Date()), "")}
                  >
                    Post next run
                  </button>
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => patchHold([...chosen], null)}>
                    Remove hold
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => setChosen(new Set())}>
                    Cancel
                  </button>
                </div>
              )}

              <div className="mt-3">
                {q ? (
                  <h2 className="lbl mb-2">
                    {listed.length} match{listed.length === 1 ? "" : "es"} for “{query.trim()}”
                  </h2>
                ) : pickedDate ? (
                  <h2 className="lbl mb-2 flex items-center gap-2">
                    {fmtHoldDate(pickedDate)} · {listed.length} item{listed.length === 1 ? "" : "s"}
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        setChosen((prev) =>
                          prev.size === listed.length ? new Set() : new Set(listed.map((d) => d.id))
                        )
                      }
                    >
                      {chosen.size === listed.length && listed.length > 0 ? "Clear selection" : "Select all"}
                    </button>
                  </h2>
                ) : (
                  <p className="m-0 rounded-panel border border-dashed border-line-strong p-6 text-center text-ink-2">
                    {held.length === 0
                      ? "Nothing on hold. Finish a draft and use Hold until… to park it for its season."
                      : "Pick a season above or a day on the calendar, or search."}
                  </p>
                )}

                {/* Two across — hundreds of held items shouldn't be one long column. */}
                {listed.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-5">
                    {listed.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 border-b border-line py-1.5 text-md">
                        <input
                          type="checkbox"
                          className="size-4 shrink-0 accent-[var(--color-accent)]"
                          checked={chosen.has(d.id)}
                          onChange={() => toggle(d.id)}
                          aria-label={`Select ${d.title}`}
                        />
                        {d.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={d.thumbnailUrl} alt="" loading="lazy" className="size-10 shrink-0 rounded-bar border border-line object-cover" />
                        ) : (
                          <div className="size-10 shrink-0 rounded-bar border border-line bg-sunken" />
                        )}
                        <div className="min-w-0 grow">
                          <div className="truncate" title={d.title}>{d.title}</div>
                          <div className="mono text-sm text-ink-3">
                            {d.sku || "No SKU"}
                            {q ? ` · ${fmtHoldDate(d.holdUntil)}` : ""}
                          </div>
                        </div>
                        <span className="shrink-0 text-right">{d.price ? money(d.price) : "—"}</span>
                        <Link href={`/generate?draft=${encodeURIComponent(d.id)}`} className="btn btn-sm shrink-0">
                          Open
                        </Link>
                        <button
                          type="button"
                          className="btn btn-sm shrink-0"
                          disabled={busy}
                          title="Move to today so it posts at the next 7am run"
                          onClick={() => patchHold([d.id], ymd(new Date()), d.holdSeason)}
                        >
                          Post next
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm shrink-0"
                          disabled={busy}
                          title="Back into the drafts queue — nothing posts by itself"
                          onClick={() => patchHold([d.id], null)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* The calendar opens over the page from the Calendar button. */}
            {calOpen && (
              <div
                className="scrim"
                onClick={(ev) => {
                  if (ev.target === ev.currentTarget) setCalOpen(false);
                }}
              >
                <div className="dialog w-[420px]" role="dialog" aria-modal="true" aria-label="Hold calendar">
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label="Previous month"
                    onClick={() => setMonthAt(new Date(monthAt.getFullYear(), monthAt.getMonth() - 1, 1))}
                  >
                    <ChevronLeftIcon className="size-3.5" />
                  </button>
                  <b className="grow text-center text-md">{monthLabel}</b>
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label="Next month"
                    onClick={() => setMonthAt(new Date(monthAt.getFullYear(), monthAt.getMonth() + 1, 1))}
                  >
                    <ChevronRightIcon className="size-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-2xs text-ink-3">
                  {DOW.map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                {cal.map((week, wi) => (
                  <div key={wi} className="mt-1 grid grid-cols-7 gap-1">
                    {week.map((c) => {
                      const on = pickedDate === c.key && !q;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          disabled={!c.count}
                          title={c.count ? `${c.count} item${c.count === 1 ? "" : "s"} · ${money(c.value)}` : ""}
                          onClick={() => {
                            setQuery("");
                            setPickedDate(on ? "" : c.key);
                            setCalOpen(false);
                          }}
                          className={`flex h-10 flex-col items-center justify-center rounded-bar border text-sm ${
                            on
                              ? "border-accent bg-accent text-on-accent"
                              : c.count
                                ? "cursor-pointer border-accent-line bg-accent-weak text-accent hover:bg-panel-2"
                                : "border-transparent bg-transparent"
                          } ${c.thisMonth ? "" : "opacity-40"}`}
                        >
                          <span>{c.day}</span>
                          {c.count > 0 && <span className="text-2xs font-semibold">{c.count}</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
                  <div className="mt-2 flex items-center gap-2">
                    <p className="hint m-0 grow">
                      Days with held items are highlighted; the number is how many post that morning.
                    </p>
                    <button type="button" className="btn btn-sm" onClick={() => setCalOpen(false)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
