"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshIcon, Spinner, TrashIcon } from "@/components/ui/Icons";
import { SEASONS, daysUntil, fmtHoldDate, nextSeasonDate, ymd } from "@/lib/seasons";

// On Hold — finished drafts waiting for their season. The app posts them at
// 7am Central on their day; nothing here has to be opened again.
// See docs/Plans/Seasonal Hold Plan.md.

const money = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function OnHoldPage() {
  const [drafts, setDrafts] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    try {
      const [d, r] = await Promise.all([
        fetch("/api/drafts", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/hold-runs", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
      ]);
      if (!d.success) throw new Error(d.error || "Couldn't load drafts");
      setDrafts((d.drafts || []).filter((x) => x.holdUntil));
      if (r?.success) setRuns(r.runs || []);
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

  // One card per posting day, soonest first.
  const days = useMemo(() => {
    const by = new Map();
    for (const d of drafts || []) {
      const key = d.holdUntil;
      if (!by.has(key)) by.set(key, { date: key, season: d.holdSeason, items: [], value: 0 });
      const g = by.get(key);
      g.items.push(d);
      g.value += d.price || 0;
      if (d.holdSeason && !g.season) g.season = d.holdSeason;
    }
    return [...by.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [drafts]);

  const total = (drafts || []).reduce((s, d) => s + (d.price || 0), 0);

  async function changeHold(id, date, season) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/drafts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdUntil: date, holdSeason: season || "" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Couldn't change the hold");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  const lastRun = runs[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-13 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
        <h1 className="m-0 whitespace-nowrap text-xl font-semibold tracking-[-0.01em]">On Hold</h1>
        <span className="text-sm text-ink-3">Posts itself at 7am Central on its day</span>
        <div className="grow" />
        {drafts && (
          <span className="text-md">
            <b>{drafts.length}</b> items on hold · <b>{money(total)}</b>
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
              Last posting morning ({new Date(lastRun.at).toLocaleDateString([], { month: "short", day: "numeric" })}):{" "}
              <b>{lastRun.posted}</b> listed · {money(lastRun.value)}
              {lastRun.failed ? ` · ${lastRun.failed} couldn't post (back in your drafts): ${lastRun.problems}` : ""}
            </p>
          </div>
        )}

        {loading && !drafts ? (
          <div className="flex items-center justify-center gap-2 p-16 text-ink-2">
            <Spinner className="size-4" /> Loading…
          </div>
        ) : days.length === 0 ? (
          <div className="rounded-panel border border-dashed border-line-strong p-8 text-center text-ink-2">
            Nothing on hold. Finish a draft and use <b>Hold until…</b> to park it for its season.
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm text-ink-3">
              {SEASONS.map((s) => (
                <span key={s.key} className="rounded-chip border border-line px-2.5 py-1">
                  {s.label} — {fmtHoldDate(ymd(nextSeasonDate(s)))} · {s.covers}
                </span>
              ))}
            </div>
          </div>
        ) : (
          days.map((g) => (
            <section key={g.date} className="mb-4 rounded-panel border border-line">
              <div className="flex flex-wrap items-baseline gap-x-3 border-b border-line px-4 py-2.5">
                <h2 className="m-0 text-lg font-semibold">
                  {g.season || "Hold"} — {fmtHoldDate(g.date)}
                </h2>
                <span className="text-md text-ink-2">
                  {g.items.length} item{g.items.length === 1 ? "" : "s"} · {money(g.value)}
                </span>
                <div className="grow" />
                <span className="text-sm text-ink-3">
                  {daysUntil(g.date) <= 0 ? "posts next run" : `in ${daysUntil(g.date)} days`}
                </span>
              </div>
              <table className="w-full table-fixed border-collapse text-md">
                <tbody>
                  {g.items.map((d) => (
                    <tr key={d.id} className="border-b border-line last:border-0">
                      <td className="w-[60px] py-1.5 pl-4">
                        {d.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={d.thumbnailUrl} alt="" loading="lazy" className="size-10 rounded-bar border border-line object-cover" />
                        ) : (
                          <div className="size-10 rounded-bar border border-line bg-sunken" />
                        )}
                      </td>
                      <td className="py-1.5 pr-3">
                        <div className="truncate" title={d.title}>{d.title}</div>
                        <div className="mono text-sm text-ink-3">{d.sku || "No SKU"}</div>
                      </td>
                      <td className="w-[90px] py-1.5 pr-3 text-right">{d.price ? money(d.price) : "—"}</td>
                      <td className="w-[320px] py-1.5 pr-4 text-right">
                        <Link href={`/generate?draft=${encodeURIComponent(d.id)}`} className="btn btn-sm">
                          Open
                        </Link>
                        <button
                          type="button"
                          className="btn btn-sm ml-2"
                          disabled={busyId === d.id}
                          onClick={() => changeHold(d.id, ymd(new Date()), g.season)}
                        >
                          Post next run
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm ml-2"
                          disabled={busyId === d.id}
                          onClick={() => changeHold(d.id, null)}
                          title="Back into the drafts queue, no automatic posting"
                        >
                          <TrashIcon className="size-[13px]" />
                          Unhold
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
