"use client";

import { useState } from "react";
import { PlusIcon } from "@/components/ui/Icons";

// The three note boxes on Create Listing, in order:
//   1. Draft Note — the user's note to themselves (never sent to the AI or eBay)
//   2. AI Note    — the AI's "check this" message, read-only, amber, with Clear
//   3. AI Read    — what the user writes for the AI to read when analyzing
//                   (stored as listing.aiNote — the box that used to be called
//                   "AI Note")
// An empty Draft Note / AI Read shrinks to one line with a ＋; a box with
// text is always open. The AI Note is hidden when the AI left nothing.
export default function Notes({ editor: e, touch = false }) {
  const messages = Array.isArray(e.listing.aiMessages) ? e.listing.aiMessages : [];
  return (
    <>
      <NoteField
        id="draft-note"
        label="Draft Note"
        value={e.listing.draftNote}
        placeholder="Notes for yourself — not sent to eBay or the AI"
        onChange={(v) => e.updateListing((prev) => ({ ...prev, draftNote: v }))}
        touch={touch}
      />
      {messages.length > 0 && (
        <div className="rounded-panel border border-warn-line bg-warn-weak px-3 py-2.5 text-warn">
          <div className="flex items-center gap-2">
            <h2 className="lbl text-warn">AI Note</h2>
            <div className="grow" />
            <button
              type="button"
              className={`btn ${touch ? "h-9 px-3" : "btn-sm"} border-warn-line bg-transparent text-warn hover:bg-panel`}
              onClick={() => e.updateListing((prev) => ({ ...prev, aiMessages: [] }))}
            >
              Clear
            </button>
          </div>
          <ul className={`m-0 mt-1.5 list-disc pl-4 ${touch ? "text-lg leading-6" : "text-md leading-[19px]"}`}>
            {messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <NoteField
        id="ai-read"
        label="AI Read"
        value={e.listing.aiNote}
        placeholder="For the AI to read when analyzing — e.g. tag says 32 but it measures 30, use the measured size"
        onChange={(v) => e.updateListing((prev) => ({ ...prev, aiNote: v }))}
        touch={touch}
      />
    </>
  );
}

function NoteField({ id, label, value, placeholder, onChange, touch }) {
  const filled = !!value?.trim();
  const [opened, setOpened] = useState(false);
  const open = filled || opened;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpened(true)}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-panel border border-dashed border-line-strong bg-transparent px-3 text-left hover:bg-panel-2 ${
          touch ? "h-touch" : "h-9"
        }`}
      >
        <span className="lbl">{label}</span>
        <div className="grow" />
        <PlusIcon className="size-4 text-ink-3" />
      </button>
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label htmlFor={id} className={`lbl ${filled ? "text-bad" : ""}`}>
          {label}
        </label>
        {filled && <span className="size-1.5 rounded-full bg-bad" />}
      </div>
      <textarea
        id={id}
        rows={touch ? 3 : 3}
        autoFocus={!filled}
        value={value || ""}
        placeholder={placeholder}
        onChange={(ev) => onChange(ev.target.value)}
        onBlur={(ev) => {
          if (!ev.target.value.trim()) setOpened(false);
        }}
        className={`textarea ${touch ? "rounded-panel p-3 text-lg leading-5" : ""} ${filled ? "input-filled" : ""}`}
      />
    </div>
  );
}
