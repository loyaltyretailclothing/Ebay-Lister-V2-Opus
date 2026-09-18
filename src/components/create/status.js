"use client";

import { AlertIcon, CheckCircleIcon, CheckIcon, Spinner } from "@/components/ui/Icons";
import { DismissX } from "@/components/create/parts";

// Status messages: desktop shows them all centered in the action bar; the
// phone has two strips. Results of List on
// eBay live here — never inside a scrolling pane, where they could be
// scrolled out of sight. Messages are the app's own, verbatim.

// Promotion result → text, and whether it deserves amber. A listing that
// went live is never red: if only the promotion failed it is amber.
export function promoInfo(pr) {
  if (!pr) return { text: "", warn: false };
  if (pr === "promoted") return { text: "Promoted.", warn: false };
  if (pr === "promoted_updated") return { text: "Promoted (rate updated).", warn: false };
  if (pr === "promoted_existing") return { text: "Already promoted.", warn: false };
  if (pr === "no_campaign") return { text: "Not promoted: no promotion campaign found.", warn: true };
  if (pr.startsWith("promo_failed")) {
    const detail = pr.replace(/^promo_failed:?\s*/, "").trim();
    const reason = detail ? `: ${detail}${/[.!?]$/.test(detail) ? "" : "."}` : ".";
    return { text: `Promotion failed${reason} The listing is live.`, warn: true };
  }
  return { text: pr, warn: false };
}

function focusSku() {
  const el = document.getElementById("sku");
  if (el) {
    el.focus();
    el.scrollIntoView({ block: "center" });
  }
}

function lookupText(lookup) {
  if (lookup.kind === "found") return `Style number ${lookup.styleNumber} found · ${lookup.styleName}`;
  if (lookup.kind === "none") return `Searched style number ${lookup.styleNumber} but found no style name`;
  return `Style lookup failed for style number ${lookup.styleNumber}`;
}

// Desktop: every message sits centered in the action bar, so nothing below
// moves when one appears or goes. One at a time: listed > errors >
// analyzing > draft deleted > style lookup.
const PILL = {
  ok: "border-ok-line bg-ok-weak text-ok",
  warn: "border-warn-line bg-warn-weak text-warn",
  info: "border-line-strong bg-sunken text-ink-2",
  bad: "border-bad-line bg-bad-weak text-bad",
};

// Errors may wrap to two lines (the bar is 52px tall); anything longer is
// cut with "…" and the full text shows on hover.
function Pill({ tone, icon, children, actions, onDismiss, full }) {
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      title={full}
      className={`flex min-h-9 min-w-0 max-w-full items-center gap-2 rounded-chip border py-1 pl-3 ${onDismiss ? "pr-1" : "pr-3"} text-sm font-medium ${PILL[tone]}`}
    >
      {icon}
      <p className={`m-0 min-w-0 ${full ? "line-clamp-2 leading-4" : "truncate"}`}>{children}</p>
      {actions}
      {onDismiss && <DismissX onClick={onDismiss} />}
    </div>
  );
}

function ErrorPill({ message, actions, onDismiss }) {
  return (
    <Pill tone="bad" icon={<AlertIcon className="size-3.5 shrink-0" />} full={message} actions={actions} onDismiss={onDismiss}>
      {message}
    </Pill>
  );
}

export function TopMessage({ editor }) {
  const e = editor;
  const s = e.submitStatus;
  // Listed first: it only lives 10 seconds, and a problem on the draft that
  // opens next is still there after it goes. (A new List on eBay clears it,
  // so it never hides a listing failure.)
  if (e.listed) {
    const promo = promoInfo(e.listed.promoResult);
    const text = `Listed on eBay! Item ${e.listed.listingId}${promo.text ? ` · ${promo.text}` : ""}`;
    return (
      <Pill
        tone={promo.warn ? "warn" : "ok"}
        icon={<CheckCircleIcon className="size-3.5 shrink-0" />}
        onDismiss={e.dismissListed}
        full={promo.warn ? text : undefined}
        actions={
          e.listed.url && (
            <a href={e.listed.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm shrink-0">
              View on eBay
            </a>
          )
        }
      >
        <span className="font-semibold">Listed on eBay!</span> Item{" "}
        <span className="mono">{e.listed.listingId}</span>
        {promo.text ? ` · ${promo.text}` : ""}
      </Pill>
    );
  }
  if (s?.type === "error") {
    return (
      <ErrorPill
        message={s.message}
        onDismiss={e.dismissSubmitStatus}
        actions={
          s.step === "sku_check" && (
            <button type="button" className="btn btn-sm btn-danger shrink-0" onClick={focusSku}>
              Change SKU
            </button>
          )
        }
      />
    );
  }
  if (e.error || e.saveError) {
    return <ErrorPill message={e.error || e.saveError} onDismiss={e.dismissError} />;
  }
  if (e.draftError) {
    return <ErrorPill message={e.draftError} onDismiss={e.dismissDraftError} />;
  }
  if (e.analyzing) {
    return (
      <Pill tone="info" icon={<Spinner className="size-3.5 shrink-0" />}>
        {e.analysisStep || "Analyzing photos…"}
      </Pill>
    );
  }
  if (e.notice?.kind === "deleted") {
    return (
      <Pill
        tone="info"
        icon={<CheckCircleIcon className="size-3.5 shrink-0" />}
        onDismiss={e.dismissNotice}
        actions={
          <button type="button" className="btn btn-sm shrink-0" onClick={e.nextDraft}>
            Next draft
          </button>
        }
      >
        Draft deleted. Its photos are still in your Photo Library.
      </Pill>
    );
  }
  if (e.lookup) {
    const tone = e.lookup.kind === "found" ? "ok" : e.lookup.kind === "failed" ? "bad" : "info";
    return (
      <Pill
        tone={tone}
        icon={
          e.lookup.kind === "failed" ? (
            <AlertIcon className="size-3.5 shrink-0" />
          ) : (
            <CheckCircleIcon className="size-3.5 shrink-0" />
          )
        }
        onDismiss={e.dismissLookup}
      >
        {lookupText(e.lookup)}
      </Pill>
    );
  }
  return null;
}

// Phone TOP lane: what the app just did to the draft.
export function PhoneTopLane({ editor }) {
  const e = editor;
  if (e.analyzing) {
    return (
      <div className="lane lane-info shrink-0 px-3">
        <Spinner className="size-[13px]" />
        <p>{e.analysisStep || "Analyzing photos…"}</p>
      </div>
    );
  }
  if (e.error || e.saveError) {
    return (
      <div className="lane lane-bad shrink-0 px-3">
        <AlertIcon className="size-[13px]" />
        <p>{e.error || e.saveError}</p>
      </div>
    );
  }
  if (e.draftError) {
    return (
      <div className="lane lane-bad shrink-0 px-3">
        <AlertIcon className="size-[13px]" />
        <p>{e.draftError}</p>
      </div>
    );
  }
  if (e.saveFlash) {
    return (
      <div className="lane lane-ok shrink-0 px-3">
        <CheckIcon className="size-[13px]" />
        <p>Draft saved</p>
      </div>
    );
  }
  if (e.notice?.kind === "deleted") {
    return (
      <div className="lane lane-info shrink-0 items-center px-3">
        <CheckCircleIcon className="size-[13px]" />
        <p>Draft deleted. Its photos are still in your Photo Library.</p>
        <button type="button" className="btn h-8 px-2.5 text-base" onClick={e.nextDraft}>
          Next draft
        </button>
        <DismissX onClick={e.dismissNotice} />
      </div>
    );
  }
  if (e.lookup) {
    const cls = e.lookup.kind === "found" ? "lane-ok" : e.lookup.kind === "failed" ? "lane-bad" : "lane-info";
    return (
      <div className={`lane ${cls} shrink-0 px-3`}>
        {e.lookup.kind === "failed" ? <AlertIcon className="size-[13px]" /> : <CheckCircleIcon className="size-[13px]" />}
        <p>{lookupText(e.lookup)}</p>
        <DismissX onClick={e.dismissLookup} />
      </div>
    );
  }
  return null;
}

// Phone PINNED strip above the action bar: anything about listing.
// Precedence: failure > success > missing fields.
export function PhonePin({ editor, missing }) {
  const e = editor;
  const s = e.submitStatus;
  if (s?.type === "error") {
    return (
      <div className="pin pin-bad">
        <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
        <p>{s.message}</p>
        {s.step === "sku_check" && (
          <button type="button" className="btn btn-danger h-8 px-2.5 text-base" onClick={focusSku}>
            Change SKU
          </button>
        )}
        <DismissX onClick={e.dismissSubmitStatus} />
      </div>
    );
  }
  if (e.listed) {
    const promo = promoInfo(e.listed.promoResult);
    return (
      <div className={`pin ${promo.warn ? "pin-warn" : "pin-ok"} items-center`}>
        <CheckCircleIcon className="size-3.5 shrink-0" />
        <p className="!font-semibold">
          Listed on eBay!
          <span className="block font-normal">
            Item <span className="mono">{e.listed.listingId}</span>
            {promo.text ? ` · ${promo.text}` : ""}
          </span>
        </p>
        {e.listed.url && (
          <a
            href={e.listed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn h-[38px] shrink-0 border-current/40 px-2.5 text-base text-current"
          >
            View on eBay
          </a>
        )}
        <DismissX onClick={e.dismissListed} />
      </div>
    );
  }
  if (missing) {
    return (
      <div className="pin pin-warn">
        <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
        <p>Title, category, price and SKU are required to list.</p>
      </div>
    );
  }
  return null;
}
