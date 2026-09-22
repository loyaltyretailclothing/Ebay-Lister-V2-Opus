"use client";

import Link from "next/link";
import useWide from "@/hooks/useWide";

const SECTIONS = [
  { key: "categories", href: "/settings/categories", label: "Categories", short: "Categories", desc: "eBay categories and their multi-value specifics" },
  { key: "policies", href: "/settings/policies", label: "Policies", short: "Policies", desc: "Payment, shipping and returns" },
  { key: "seasons", href: "/settings/seasons", label: "Seasons", short: "Seasons", desc: "Hold dates and what each season covers" },
  { key: "account", href: "/oauth", label: "eBay Account", short: "Account", desc: "Connection and refresh token" },
];

// Settings frame. The section list never goes away — including during the
// eBay connection (which used to take over the screen and lose the way back).
// Desktop: a 236px section column. Phone: a segmented control.
export default function SettingsShell({ active, children }) {
  const wide = useWide();
  if (wide === null) return null;
  const current = SECTIONS.find((s) => s.key === active);

  if (wide) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-13 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
          <h1 className="m-0 text-xl font-semibold tracking-[-0.01em]">Settings</h1>
          <span aria-hidden="true" className="h-[18px] w-px bg-line" />
          <p className="m-0 text-md text-ink-2">{current?.label}</p>
        </header>
        <div className="flex min-h-0 grow">
          <aside className="flex w-[236px] shrink-0 flex-col gap-[3px] border-r border-line bg-panel px-2.5 py-3">
            {SECTIONS.map((s) => (
              <Link
                key={s.key}
                href={s.href}
                aria-current={s.key === active ? "true" : undefined}
                className={`snav ${s.key === active ? "snav-on" : ""}`}
              >
                <b className="block text-md font-semibold">{s.label}</b>
                <span className="mt-0.5 block text-sm leading-[15px] opacity-80">{s.desc}</span>
              </Link>
            ))}
          </aside>
          <main className="min-w-0 grow overflow-y-auto bg-bg px-[18px] pb-7 pt-4">
            <div className="max-w-[1060px]">{children({ touch: false })}</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[640px] flex-col bg-panel">
      <header className="flex h-14 shrink-0 items-center border-b border-line px-3.5">
        <h1 className="m-0 text-3xl font-semibold tracking-[-0.01em]">Settings</h1>
      </header>
      <div className="shrink-0 px-3 py-2">
        <div className="seg seg-touch">
          {SECTIONS.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              aria-pressed={s.key === active}
              className={`flex h-[38px] min-w-0 flex-1 items-center justify-center rounded-field text-md font-medium no-underline ${
                s.key === active ? "bg-panel font-semibold text-ink shadow-ctl" : "text-ink-2"
              }`}
            >
              {s.short}
            </Link>
          ))}
        </div>
      </div>
      <main className="min-h-0 grow overflow-y-auto bg-panel px-3 pb-[58px] pt-1">{children({ touch: true })}</main>
    </div>
  );
}
