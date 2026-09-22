"use client";

import { useState } from "react";
import { SEASONS, fmtHoldDate, nextSeasonDate, suggestSeason, ymd } from "@/lib/seasons";

// "Hold until…" — the finished draft leaves the queue and the app posts it
// on the chosen morning by itself. See docs/Plans/Seasonal Hold Plan.md.
export default function HoldDialog({ editor: e, open, onClose, touch = false }) {
  const suggestion = open ? suggestSeason(e.listing) : null;
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const missing = [];
  if (!e.listing.title?.trim()) missing.push("title");
  if (!e.listing.categoryId) missing.push("category");
  if (!e.listing.price) missing.push("price");
  if (!String(e.listing.sku || "").trim()) missing.push("SKU");
  if (!e.listingPhotos.length) missing.push("photos");

  async function hold(date, season) {
    if (busy || !date) return;
    setBusy(true);
    const ok = await e.holdDraft({ date, season });
    setBusy(false);
    if (ok) {
      onClose();
      e.nextDraft();
    }
  }

  return (
    <div
      className="scrim"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="dialog max-w-[520px]" role="dialog" aria-modal="true" aria-label="Hold until">
        <h2 className={`m-0 ${touch ? "text-2xl" : "text-lg"} font-semibold`}>Hold until…</h2>
        <p className="hint mt-1">
          The draft leaves your queue and the app posts it to eBay by itself at 7am on the day you pick.
          Finish everything first — it posts exactly as saved.
        </p>

        {missing.length > 0 && (
          <p className="mt-2.5 rounded-bar border border-bad-line bg-bad-weak px-3 py-2 text-md font-medium text-bad">
            Add {missing.join(", ")} before holding — a draft missing those can&apos;t post on its own.
          </p>
        )}

        {suggestion && (
          <p className="mt-2.5 rounded-bar border border-accent-line bg-accent-weak px-3 py-2 text-md text-accent">
            Looks like a {suggestion.season.label.toLowerCase()} item — hold until{" "}
            {fmtHoldDate(suggestion.date)}?
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {SEASONS.map((s) => {
            const date = ymd(nextSeasonDate(s));
            const picked = suggestion?.season.key === s.key;
            return (
              <button
                key={s.key}
                type="button"
                disabled={busy || missing.length > 0}
                onClick={() => hold(date, s.label)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-panel border px-3 py-2.5 text-left disabled:opacity-50 ${
                  picked ? "border-accent-line bg-accent-weak" : "border-line bg-transparent hover:bg-panel-2"
                }`}
              >
                <span className="min-w-[70px] text-lg font-semibold">{s.label}</span>
                <span className="min-w-[110px] text-md">{fmtHoldDate(date)}</span>
                <span className="grow text-sm text-ink-2">{s.covers}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <label className="lbl" htmlFor="hold-custom">
            Or a date
          </label>
          <input
            id="hold-custom"
            type="date"
            className={`input ${touch ? "h-touch" : "h-9"} w-[170px]`}
            value={custom}
            onChange={(ev) => setCustom(ev.target.value)}
          />
          <button
            type="button"
            className="btn"
            disabled={busy || !custom || missing.length > 0}
            onClick={() => hold(custom, "Custom")}
          >
            Hold
          </button>
          <div className="grow" />
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
