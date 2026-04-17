"use client";

import { useEffect } from "react";

export default function SuccessModal({
  open,
  onClose,
  onNewListing,
  thumbnailUrl,
  listingUrl,
  promoResult,
}) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const promoMsg =
    promoResult === "promoted"
      ? "Promoted"
      : promoResult === "promoted_updated"
        ? "Promoted (rate updated)"
        : promoResult === "promoted_existing"
          ? "Already promoted"
          : promoResult === "no_campaign"
            ? "No promotion campaign"
            : promoResult?.startsWith("promo_failed")
              ? "Promotion failed"
              : null;

  const thumb = thumbnailUrl
    ? thumbnailUrl.replace("/upload/", "/upload/c_fill,w_400,h_400/")
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Close"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Thumbnail */}
        {thumb && (
          <div className="mx-auto mb-4 aspect-square w-32 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
            <img
              src={thumb}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Success check */}
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400">
          <svg
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>

        {/* Text */}
        <h2 className="text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Listed on eBay!
        </h2>
        {promoMsg && (
          <p className="mt-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {promoMsg}
          </p>
        )}

        {/* Buttons */}
        <div className="mt-6 flex flex-col gap-2">
          {listingUrl && (
            <a
              href={listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              View on eBay
            </a>
          )}
          <button
            onClick={onNewListing}
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Generate New Listing
          </button>
        </div>
      </div>
    </div>
  );
}
