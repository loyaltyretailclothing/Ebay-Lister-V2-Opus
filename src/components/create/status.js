"use client";

import { AlertIcon, CheckCircleIcon, CheckIcon, Spinner } from "@/components/ui/Icons";
import { DismissX } from "@/components/create/parts";
import { thumbUrl } from "@/lib/resizeImage";

// The status lane (desktop, under the action bar) and the phone's two strips.
// Results of List on eBay live here — never inside a scrolling pane, where
// they could be scrolled out of sight. Messages are the app's own, verbatim.

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

// Success content shared by desktop and phone.
function Listed({ status, touch, onNext, onNew }) {
  const promo = promoInfo(status.promoResult);
  return (
    <>
      {status.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl(status.thumbnailUrl, 120)}
          alt=""
          className={`shrink-0 rounded-bar border border-current/30 object-cover ${touch ? "size-[38px]" : "size-9"}`}
        />
      ) : (
        <CheckCircleIcon className="size-3.5" />
      )}
      <p className="!font-semibold">
        Listed on eBay!
        <span className="block font-normal">
          Item <span className="mono">{status.listingId}</span>
          {promo.text ? ` · ${promo.text}` : ""}
        </span>
      </p>
      {!touch && (
        <div className="acts">
          {status.url && (
            <a href={status.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
              View on eBay
            </a>
          )}
          <button type="button" className="btn btn-sm" onClick={onNext}>
            Next draft
          </button>
          <button type="button" className="btn btn-sm" onClick={onNew}>
            New listing
          </button>
        </div>
      )}
    </>
  );
}

// ONE lane on desktop, one state at a time.
export function DesktopLane({ editor }) {
  const e = editor;
  const s = e.submitStatus;

  if (s?.type === "error") {
    return (
      <div className="lane lane-bad shrink-0">
        <AlertIcon className="size-3.5" />
        <p>{s.message}</p>
        <div className="acts">
          {s.step === "sku_check" && (
            <button type="button" className="btn btn-sm btn-danger" onClick={focusSku}>
              Change SKU
            </button>
          )}
          <DismissX onClick={e.dismissSubmitStatus} />
        </div>
      </div>
    );
  }
  if (s?.type === "success") {
    const warn = promoInfo(s.promoResult).warn;
    return (
      <div className={`lane ${warn ? "lane-warn" : "lane-ok"} shrink-0 items-center`}>
        <Listed status={s} onNext={e.nextDraft} onNew={e.newListing} />
        <DismissX onClick={e.dismissSubmitStatus} />
      </div>
    );
  }
  if (e.analyzing) {
    return (
      <div className="lane lane-info shrink-0">
        <Spinner className="size-3.5" />
        <p>{e.analysisStep || "Analyzing photos…"}</p>
      </div>
    );
  }
  if (e.error || e.saveError) {
    return (
      <div className="lane lane-bad shrink-0">
        <AlertIcon className="size-3.5" />
        <p>{e.error || e.saveError}</p>
      </div>
    );
  }
  if (e.draftError) {
    return (
      <div className="lane lane-bad shrink-0">
        <AlertIcon className="size-3.5" />
        <p>{e.draftError}</p>
      </div>
    );
  }
  if (e.notice?.kind === "deleted") {
    return (
      <div className="lane lane-info shrink-0 items-center">
        <CheckCircleIcon className="size-3.5" />
        <p>Draft deleted. Its photos are still in your Photo Library.</p>
        <div className="acts">
          <button type="button" className="btn btn-sm" onClick={e.nextDraft}>
            Next draft
          </button>
          <DismissX onClick={e.dismissNotice} />
        </div>
      </div>
    );
  }
  if (e.lookup) {
    const cls = e.lookup.kind === "found" ? "lane-ok" : e.lookup.kind === "failed" ? "lane-bad" : "lane-info";
    return (
      <div className={`lane ${cls} shrink-0`}>
        {e.lookup.kind === "failed" ? <AlertIcon className="size-3.5" /> : <CheckCircleIcon className="size-3.5" />}
        <p>{lookupText(e.lookup)}</p>
        <DismissX onClick={e.dismissLookup} />
      </div>
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
  if (s?.type === "success") {
    const warn = promoInfo(s.promoResult).warn;
    return (
      <div className={`pin ${warn ? "pin-warn" : "pin-ok"} flex-col gap-[9px]`}>
        <div className="flex w-full items-start gap-[9px]">
          <Listed status={s} touch />
          <DismissX onClick={e.dismissSubmitStatus} />
        </div>
        <div className="flex w-full gap-[7px]">
          {s.url && (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn h-[38px] min-w-0 flex-1 border-current/40 px-2 text-base text-current"
            >
              View on eBay
            </a>
          )}
          <button type="button" className="btn h-[38px] min-w-0 flex-1 border-current/40 px-2 text-base text-current" onClick={e.nextDraft}>
            Next draft
          </button>
          <button type="button" className="btn h-[38px] min-w-0 flex-1 border-current/40 px-2 text-base text-current" onClick={e.newListing}>
            New listing
          </button>
        </div>
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
