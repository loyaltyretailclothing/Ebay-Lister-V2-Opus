"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Voice notes: the browser's own speech-to-text (Chrome's, the same one the
// Google keyboard mic uses). Free, no AI. The mic stops by itself after 1
// second of silence, or when tapped again; what was said is ADDED to the note.
// Where the browser has no speech-to-text, `supported` is false and the mic
// buttons don't show.

function Recognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const subscribe = () => () => {};

// Stop listening after this long with no new words.
const SILENCE_MS = 1000;
// If nothing is said at all, give up after this long.
const NOTHING_SAID_MS = 8000;

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

    // Chrome's own pause detection can't be tuned, so the mic stays open
    // (continuous) and the app stops it after SILENCE_MS with no new words.
    const rec = new Rec();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    let finalText = "";
    let live = "";
    let failed = false;
    let silence = null;
    const armSilence = () => {
      clearTimeout(silence);
      silence = setTimeout(() => rec.stop(), SILENCE_MS);
    };

    rec.onresult = (ev) => {
      // Rebuilt from every result each time. Android Chrome can repeat the
      // whole sentence so far as a new result — keep the longer one instead
      // of saying it twice.
      let finals = "";
      live = "";
      for (let i = 0; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript.trim();
        if (!t) continue;
        if (ev.results[i].isFinal) {
          if (finals && t.toLowerCase().startsWith(finals.toLowerCase())) finals = t;
          else finals = finals ? `${finals} ${t}` : t;
        } else {
          live = live ? `${live} ${t}` : t;
        }
      }
      finalText = finals;
      setHeard(`${finalText} ${live}`.trim());
      armSilence();
    };
    rec.onerror = (ev) => {
      if (ev.error === "aborted") return;
      failed = true;
      setError({ key, message: ERRORS[ev.error] || "Voice didn't work — try again." });
    };
    rec.onend = () => {
      clearTimeout(silence);
      if (recRef.current === rec) recRef.current = null;
      // Words still being worked out when it stopped count too.
      const text = `${finalText} ${live}`.trim();
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
      // Continuous mode never times out by itself when nobody talks.
      silence = setTimeout(() => rec.stop(), NOTHING_SAID_MS);
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
