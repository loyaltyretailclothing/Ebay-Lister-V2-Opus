"use client";

import { MicIcon } from "@/components/ui/Icons";

// The voice-note mic: grey when idle, red and pulsing while listening.
export default function MicButton({ listening, onClick, label, className = "" }) {
  return (
    <button
      type="button"
      aria-label={listening ? `Stop voice for ${label}` : `Speak ${label}`}
      aria-pressed={listening}
      onClick={onClick}
      className={`btn shrink-0 !px-0 ${
        listening ? "animate-pulse !border-bad !bg-bad !text-white" : ""
      } ${className}`}
    >
      <MicIcon className="size-[17px]" />
    </button>
  );
}

// What the mic is hearing, or why it didn't work.
export function VoiceStatus({ voice, noteKey, className = "" }) {
  if (voice.active === noteKey) {
    return (
      <p className={`m-0 text-sm font-medium text-bad ${className}`}>
        Listening…{voice.heard ? ` “${voice.heard}”` : " start talking"}
      </p>
    );
  }
  if (voice.error?.key === noteKey) {
    return <p className={`m-0 text-sm font-medium text-bad ${className}`}>{voice.error.message}</p>;
  }
  return null;
}
