"use client";

import Link from "next/link";
import SettingsShell from "@/components/settings/SettingsShell";
import { SEASONS, fmtHoldDate, nextSeasonDate, seasonStart, seasonStop, ymd } from "@/lib/seasons";

// Settings → Seasons. What "Hold until…" means: the dates, and which items
// belong to each season (from the research in
// docs/Plans/Seasonal Hold Plan.md).
export default function SeasonsSettingsPage() {
  return (
    <SettingsShell active="seasons">
      {({ touch }) => (
        <div className={touch ? "px-3 pb-8 pt-1" : ""}>
          <p className={`m-0 ${touch ? "text-lg" : "text-md"} text-ink-2`}>
            Finish a draft, tap <b>Hold until…</b>, and it leaves your queue. The app posts it to eBay
            by itself at <b>7am Central</b> on the date below. Dates are set ~6–8 weeks before buyers
            start shopping that season.
          </p>

          <div className={`mt-4 grid gap-3 ${touch ? "" : "grid-cols-2"}`}>
            {SEASONS.map((s) => (
              <div key={s.key} className="rounded-panel border border-line p-3.5">
                <div className="flex items-baseline gap-2">
                  <h2 className="m-0 text-lg font-semibold">{s.label}</h2>
                  <span className="badge">{fmtHoldDate(ymd(nextSeasonDate(s)))}</span>
                </div>
                <p className="m-0 mt-1 text-md text-ink-2">{s.covers}</p>
                <p className="m-0 mt-0.5 text-md">
                  <span className="text-ink-3">Stop listing after</span> <b>{seasonStop(s)}</b>{" "}
                  <span className="text-ink-3">— hold the rest for {seasonStart(s)}</span>
                </p>
                {s.suggestFor.length > 0 && (
                  <p className="hint mt-1.5">
                    Suggested automatically for: {s.suggestFor.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-panel border border-line bg-sunken p-3.5 text-md text-ink-2">
            <b className="text-ink">Worth knowing.</b> eBay publishes no official &quot;list by&quot; calendar
            for clothing. These dates come from shopper-behaviour surveys and experienced sellers.
            Plenty of high-volume sellers argue against holding ordinary clothes at all — a held item
            can&apos;t sell — so the app only suggests a hold for heavy outerwear, snow gear and
            swimwear. Everything else is your call.
            <div className="mt-2">
              To change a date or what a season covers, ask Claude — it&apos;s one line in the code.
              Items already on hold keep the date they were given.
            </div>
          </div>

          <p className="mt-4">
            <Link href="/on-hold" className="btn">
              See what&apos;s on hold
            </Link>
          </p>
        </div>
      )}
    </SettingsShell>
  );
}
