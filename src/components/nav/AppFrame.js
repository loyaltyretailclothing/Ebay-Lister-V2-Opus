"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import useWide from "@/hooks/useWide";
import {
  CameraIcon,
  CreateIcon,
  DraftsIcon,
  LibraryIcon,
  MoreIcon,
  SettingsIcon,
  TagIcon,
} from "@/components/ui/Icons";

// App chrome. Big windows (xl, 1280px+) get the desktop rail on the left;
// everything smaller gets the phone bottom bar. The camera is full screen
// with neither.
//
// Desktop rail: logo, Create Listing, Settings. Library and Drafts live in
// the Photos | Drafts panel inside Create Listing; Camera is phone only;
// Sourcing is unlinked (the page still works at /sourcing).
export default function AppFrame({ children }) {
  const pathname = usePathname() || "";
  // Same measurement as the pages use, so chrome and page always agree.
  const wide = useWide();

  if (pathname.startsWith("/camera")) {
    return <div className="h-dvh w-full overflow-hidden">{children}</div>;
  }

  return (
    <div className="app-shell flex h-dvh w-full overflow-hidden bg-bg text-ink">
      {wide === true && <DesktopRail pathname={pathname} />}
      <div className="flex min-w-0 grow flex-col">
        <div className="min-h-0 grow overflow-y-auto">{children}</div>
        {wide === false && <PhoneNav pathname={pathname} />}
      </div>
    </div>
  );
}

function DesktopRail({ pathname }) {
  const onCreate = pathname.startsWith("/generate");
  const onSettings = pathname.startsWith("/settings") || pathname.startsWith("/oauth");
  return (
    <nav
      aria-label="Main"
      className="flex w-18 shrink-0 flex-col items-center gap-0.5 border-r border-line bg-panel py-3"
    >
      <Link
        href="/generate"
        aria-label="Lister — Create Listing"
        className="mb-2.5 flex size-[34px] items-center justify-center rounded-[9px] bg-accent text-on-accent"
      >
        <TagIcon className="size-[19px]" />
      </Link>
      <Link
        href="/generate"
        aria-current={onCreate ? "page" : undefined}
        className={`rail ${onCreate ? "rail-on" : ""}`}
      >
        <CreateIcon className="size-[19px]" />
        <span className="lbl text-2xs tracking-[0.05em] text-current">Create</span>
      </Link>
      <div className="grow" />
      <Link
        href="/settings"
        aria-current={onSettings ? "page" : undefined}
        className={`rail ${onSettings ? "rail-on" : ""}`}
      >
        <SettingsIcon className="size-[19px]" />
        <span className="lbl text-2xs tracking-[0.05em] text-current">Settings</span>
      </Link>
    </nav>
  );
}

function PhoneNav({ pathname }) {
  // The More sheet belongs to the page it was opened on, so it closes by
  // itself whenever the route changes.
  const [openOn, setOpenOn] = useState(null);
  const moreOpen = openOn === pathname;
  const setMoreOpen = (v) =>
    setOpenOn(typeof v === "function" ? (v(moreOpen) ? pathname : null) : v ? pathname : null);

  const tab = (href, label, Icon, active) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`tabm ${active ? "tabm-on" : ""}`}
    >
      <Icon className="size-[21px]" />
      <span className="lbl text-2xs tracking-[0.05em] text-current">{label}</span>
    </Link>
  );

  const onMore = pathname.startsWith("/settings") || pathname.startsWith("/oauth");

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-scrim" onClick={() => setMoreOpen(false)}>
          <div
            className="bsheet absolute inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] mx-auto max-w-[640px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grab" />
            <Link href="/settings" className="sheet-row" onClick={() => setMoreOpen(false)}>
              <SettingsIcon className="size-5" />
              Settings
            </Link>
          </div>
        </div>
      )}
      <nav
        aria-label="Main"
        className="relative z-40 shrink-0 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex h-16 max-w-[640px] items-start px-1">
          {tab("/library", "Library", LibraryIcon, pathname.startsWith("/library"))}
          {tab("/generate", "Create", CreateIcon, pathname.startsWith("/generate"))}
          <div className="flex flex-1 justify-center">
            <Link href="/camera" aria-label="Open camera" className="fab">
              <CameraIcon className="size-[26px]" />
            </Link>
          </div>
          {tab("/drafts", "Drafts", DraftsIcon, pathname.startsWith("/drafts"))}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`tabm border-0 bg-transparent ${onMore || moreOpen ? "tabm-on" : ""}`}
          >
            <MoreIcon />
            <span className="lbl text-2xs tracking-[0.05em] text-current">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
