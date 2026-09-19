"use client";

import { useEffect, useState } from "react";
import { PlusIcon } from "@/components/ui/Icons";
import MicButton, { VoiceStatus } from "@/components/ui/MicButton";
import useVoiceNote, { appendSpoken } from "@/hooks/useVoiceNote";

// The three note boxes on Create Listing, in order:
//   1. Draft Note — the user's note to themselves (never sent to the AI or eBay)
//   2. AI Note    — the AI's "check this" message, read-only, amber, with Clear
//   3. AI Read    — what the user writes for the AI to read when analyzing
//                   (stored as listing.aiNote — the box that used to be called
//                   "AI Note")
// An empty Draft Note / AI Read shrinks to one line with a ＋; a box with
// text is always open. The AI Note is hidden when the AI left nothing.
//
// Both boxes have a mic: what you say is added to the end of the note.
export default function Notes({ editor: e, touch = false }) {
  const messages = Array.isArray(e.listing.aiMessages) ? e.listing.aiMessages : [];
  const voice = useVoiceNote();

  // Stop listening when a different listing is put in the form.
  const { stop } = voice;
  useEffect(() => stop, [e.session, stop]);

  // Spoken words go to the listing that was open when the mic was tapped
  // (formSetters drops them if you've since switched drafts).
  function speak(field) {
    const { onUser } = e.formSetters(e.session);
    voice.toggle(field, (text) =>
      onUser((prev) => ({ ...prev, [field]: appendSpoken(prev[field], text) }))
    );
  }

  return (
    <>
      <NoteField
        id="draft-note"
        label="Draft Note"
        value={e.listing.draftNote}
        placeholder="Notes for yourself — not sent to eBay or the AI"
        onChange={(v) => e.updateListing((prev) => ({ ...prev, draftNote: v }))}
        touch={touch}
        voice={voice}
        voiceKey="draftNote"
        onMic={() => speak("draftNote")}
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
        voice={voice}
        voiceKey="aiNote"
        onMic={() => speak("aiNote")}
      />
    </>
  );
}

function NoteField({ id, label, value, placeholder, onChange, touch, voice, voiceKey, onMic }) {
  const filled = !!value?.trim();
  // "type" = opened with ＋ (focus the box); "mic" = opened by the mic (no
  // keyboard popping up on the phone).
  const [opened, setOpened] = useState(null);
  const listening = voice.active === voiceKey;
  const open = filled || opened || listening;
  const micSize = touch ? "size-touch" : "size-7";

  const mic = voice.supported && (
    <MicButton
      label={label}
      listening={listening}
      className={micSize}
      onClick={() => {
        if (!open) setOpened("mic");
        onMic();
      }}
    />
  );

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpened("type")}
          className={`flex min-w-0 grow cursor-pointer items-center gap-2 rounded-panel border border-dashed border-line-strong bg-transparent px-3 text-left hover:bg-panel-2 ${
            touch ? "h-touch" : "h-9"
          }`}
        >
          <span className="lbl">{label}</span>
          <div className="grow" />
          <PlusIcon className="size-4 text-ink-3" />
        </button>
        {mic}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex min-h-7 items-center gap-1.5">
        <label htmlFor={id} className={`lbl ${filled ? "text-bad" : ""}`}>
          {label}
        </label>
        {filled && <span className="size-1.5 rounded-full bg-bad" />}
        <div className="grow" />
        {mic}
      </div>
      <VoiceStatus voice={voice} noteKey={voiceKey} className="mb-1.5" />
      <textarea
        id={id}
        rows={touch ? 3 : 3}
        autoFocus={!filled && opened === "type"}
        value={value || ""}
        placeholder={placeholder}
        onChange={(ev) => onChange(ev.target.value)}
        onBlur={(ev) => {
          if (!ev.target.value.trim() && !listening) setOpened(null);
        }}
        className={`textarea ${touch ? "rounded-panel p-3 text-lg leading-5" : ""} ${filled ? "input-filled" : ""}`}
      />
    </div>
  );
}
