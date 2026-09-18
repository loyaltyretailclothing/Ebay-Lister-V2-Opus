"use client";

import { useEffect, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "@/components/ui/Icons";
import { photoName } from "@/lib/resizeImage";

// Full-screen photo viewer. Dark in both themes (a photo judged for colour
// and flaws is judged against black). Previous / next by the arrows, the
// keyboard, or a swipe. Shows the file name, and the photo's note if it has
// one. No "14 / 248" counter: the library loads in batches and has no total.
export default function Lightbox({ photos, index, onIndex, onClose, showNote = true }) {
  const touchX = useRef(null);
  const photo = index !== null && index !== undefined ? photos[index] : null;
  const count = photos.length;

  useEffect(() => {
    if (!photo) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onIndex((index - 1 + count) % count);
      if (e.key === "ArrowRight") onIndex((index + 1) % count);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photo, index, count, onIndex, onClose]);

  if (!photo) return null;

  const prev = () => onIndex((index - 1 + count) % count);
  const next = () => onIndex((index + 1) % count);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[#06080b] text-[#f2f4f7]"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) (dx > 0 ? prev : next)();
      }}
    >
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-2.5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-11 cursor-pointer items-center justify-center rounded-xl border-0 bg-white/10 p-0 text-[#f2f4f7]"
        >
          <XIcon className="size-5" />
        </button>
        <div className="grow" />
        <span className="mono text-base text-[#f2f4f7]/80">{photoName(photo)}</span>
      </div>

      <div className="relative flex min-h-0 grow items-center justify-center px-3" onClick={onClose}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.secure_url}
          alt=""
          className="max-h-full max-w-full rounded-xl object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-[18px] top-1/2 -mt-[22px] flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-[#06080b]/55 p-0 text-[#f2f4f7]"
            >
              <ChevronLeftIcon className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-[18px] top-1/2 -mt-[22px] flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-[#06080b]/55 p-0 text-[#f2f4f7]"
            >
              <ChevronRightIcon className="size-5" />
            </button>
          </>
        )}
      </div>

      {showNote && photo.note ? (
        <div className="shrink-0 px-4 pb-7 pt-3.5">
          <p className="lbl text-[#f2f4f7]/55">Note on this photo</p>
          <p className="mt-1.5 text-lg leading-5 text-[#f2f4f7]">{photo.note}</p>
        </div>
      ) : (
        <div className="h-7 shrink-0" />
      )}
    </div>
  );
}
