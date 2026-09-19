"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Voice notes: the browser's own speech-to-text (Chrome's, the same one the
// Google keyboard mic uses). Free, no AI. The mic stops by itself after a
// short pause, or when tapped again; what was said is ADDED to the note.
// Where the browser has no speech-to-text, `supported` is false and the mic
// buttons don't show.

function Recognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const subscribe = () => () => {};

const ERRORS = {
  "no-speech": "Didn't hear anything — tap the mic and try again.",
  "audio-capture": "No microphone found.",
  "not-allowed": "Microphone is blocked — allow it in Chrome's site settings.",
  "service-not-allowed": "Microphone is blocked — allow it in Chrome's site settings.",
  network: "Voice needs an internet connection — try again.",
};

// "Tag says 32" + "measures 30 waist" → "Tag says 32. Measures 30 waist"
export function appendSpoken(prev, spoken) {
  const s = String(spoken || "").trim();
  if (!s) return prev || "";
  const said = s.charAt(0).toUpperCase() + s.slice(1);
  const p = String(prev || "").trimEnd();
  if (!p) return said;
  return p + (/[.!?,;:]$/.test(p) ? " " : ". ") + said;
}

export default function useVoiceNote() {
  const supported = useSyncExternalStore(subscribe, () => !!Recognition(), () => false);
  const [active, setActive] = useState(null); // which note is listening
  const [heard, setHeard] = useState(""); // live words while listening
  const [error, setError] = useState(null); // { key, message }
  const recRef = useRef(null);

  const stop = useCallback(() => recRef.current?.stop(), []);

  const start = useCallback((key, onText) => {
    const Rec = Recognition();
    if (!Rec) return;
    recRef.current?.abort();

    const rec = new Rec();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalText = "";
    let failed = false;
    rec.onresult = (ev) => {
      let live = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else live += r[0].transcript;
      }
      setHeard(`${finalText} ${live}`.trim());
    };
    rec.onerror = (ev) => {
      if (ev.error === "aborted") return;
      failed = true;
      setError({ key, message: ERRORS[ev.error] || "Voice didn't work — try again." });
    };
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null;
      const text = finalText.trim();
      if (text) onText(text);
      else if (!failed) setError({ key, message: ERRORS["no-speech"] });
      setActive((a) => (a === key ? null : a));
      setHeard("");
    };

    recRef.current = rec;
    setError(null);
    setHeard("");
    setActive(key);
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setActive(null);
      setError({ key, message: "Voice didn't work — try again." });
    }
  }, []);

  // Tap the mic: start listening for this note, or stop if it already is.
  const toggle = useCallback(
    (key, onText) => (active === key ? stop() : start(key, onText)),
    [active, start, stop]
  );

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, active, heard, error, toggle, stop };
}
