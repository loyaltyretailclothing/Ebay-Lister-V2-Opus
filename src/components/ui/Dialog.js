"use client";

import { useEffect, useRef } from "react";

// Centred confirm dialog on a scrim. Escape and a backdrop click cancel.
// The first button gets focus when it opens.
export default function Dialog({ open, onCancel, title, children, actions, touch = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector("button")?.focus();
    function onKey(e) {
      if (e.key === "Escape") onCancel?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div className="dialog" role="alertdialog" aria-modal="true">
        <p className={`m-0 font-semibold ${touch ? "text-3xl" : "text-lg"}`}>{title}</p>
        {children}
        <div ref={ref} className={`mt-4 flex gap-2 ${touch ? "" : "justify-end"}`}>
          {actions}
        </div>
      </div>
    </div>
  );
}
