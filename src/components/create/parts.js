"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, CheckIcon, PlusIcon, XIcon } from "@/components/ui/Icons";

// Small pieces shared by the desktop and phone Create Listing layouts.

export function Toggle({ on, onClick, label, touch = false }) {
  return (
    <button
      type="button"
      className={`toggle ${touch ? "toggle-touch" : ""}`}
      aria-pressed={!!on}
      aria-label={label}
      onClick={onClick}
    >
      <span className="toggle-knob" />
    </button>
  );
}

// A <select> with the chevron the design puts on every select.
export function Select({ value, onChange, children, className = "", invalid = false, id, disabled }) {
  return (
    <span className="sel">
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`select ${invalid ? "input-invalid" : ""} ${className}`}
      >
        {children}
      </select>
      <ChevronDownIcon className="size-3.5" />
    </span>
  );
}

// The readable tail of a category path, plus the parent path for a caption:
// "Men's Clothing > Shirts > Polos" / "In Clothing, Shoes & Accessories > Men".
// eBay lists ancestors nearest-first, so they are reversed to read top-down.
export function categoryLabel(cat) {
  const parts = [...(cat.ancestors || [])].reverse().concat(cat.name);
  if (parts.length <= 3) return { tail: parts.join(" > "), parent: "" };
  return { tail: parts.slice(2).join(" > "), parent: parts.slice(0, 2).join(" > ") };
}

// Keyword chips by tier. Solid = in the title, outlined + "Theme" = in Theme.
// Clicking moves a keyword between the two (the parent rebuilds the title).
const TIERS = [1, 2, 3];
export function KeywordChips({ keywords, onToggle, disabled, hasTheme, notice, touch = false }) {
  const list = Array.isArray(keywords) ? keywords : [];
  if (list.length === 0) {
    return (
      <div>
        <h2 className="lbl mb-[7px]">Keywords</h2>
        <p className="hint">Keywords arrive with Analyze Photos, tiered by search weight.</p>
      </div>
    );
  }
  const indexed = list.map((k, i) => ({ ...k, index: i }));
  return (
    <div>
      <div className="mb-[7px] flex flex-wrap items-center gap-2.5">
        <h2 className="lbl">Keywords</h2>
        <div className="grow" />
        <span className="inline-flex items-center gap-[5px] text-sm font-medium text-legend">
          <span className="swatch bg-accent" /> In title
        </span>
        <span className="inline-flex items-center gap-[5px] text-sm font-medium text-legend">
          <span className="swatch bg-ok" /> In Theme
        </span>
        <span className="inline-flex items-center gap-[5px] text-sm font-medium text-legend">
          <span className="swatch border-[1.5px] border-line-strong" /> Unused
        </span>
      </div>
      <div className={`flex flex-col ${touch ? "gap-2" : "gap-1.5"}`}>
        {TIERS.map((tier) => {
          const items = indexed.filter((k) => k.tier === tier);
          if (items.length === 0) return null;
          const chips = (
            <div className={`flex flex-wrap ${touch ? "gap-1.5" : "gap-[5px]"}`}>
              {items.map((k) => {
                const where = k.placement === "title" ? "title" : k.placement === "theme" ? "theme" : "none";
                return (
                  <button
                    key={`${k.keyword}-${k.index}`}
                    type="button"
                    // Phone: tap cycles title → Theme → unused. Desktop:
                    // click puts an unused keyword in the title or takes a
                    // used one out; right-click sends it to Theme.
                    onClick={() => onToggle(k.index, touch ? "next" : where === "none" ? "title" : "none")}
                    onContextMenu={
                      touch
                        ? undefined
                        : (e) => {
                            e.preventDefault();
                            onToggle(k.index, "theme");
                          }
                    }
                    disabled={disabled}
                    title={
                      touch
                        ? "Tap: title → Theme → unused"
                        : where === "none"
                          ? "Unused — click to put it in the title, right-click for Theme"
                          : `In ${where === "title" ? "the title" : "Theme"} — click to remove, right-click for Theme`
                    }
                    className={`chip ${
                      where === "title" ? "chip-in-title" : where === "theme" ? "chip-in-theme" : "chip-off"
                    } ${touch ? "h-8 px-3 text-base" : ""} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {k.keyword}
                  </button>
                );
              })}
            </div>
          );
          return touch ? (
            <div key={tier}>
              <p className="lbl mb-[5px] text-xs">Tier {tier}</p>
              {chips}
            </div>
          ) : (
            <div key={tier} className="flex items-start gap-2">
              <span className="lbl w-12 shrink-0 pt-[5px] text-xs">Tier {tier}</span>
              {chips}
            </div>
          );
        })}
      </div>
      {notice && <p className="mt-1.5 text-base font-medium text-warn">{notice}</p>}
    </div>
  );
}

// Shared selection logic for an item-specific picker: search, single or
// multi select, and custom values ("Your own").
function usePickerState({ options, value, onChange, multiSelect, onDone }) {
  const [search, setSearch] = useState("");
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const q = search.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  const isCustom = !!q && !options.some((o) => o.toLowerCase() === q);
  const customValues = selected.filter((v) => !options.includes(v));

  function select(val) {
    if (multiSelect) {
      if (selected.includes(val)) {
        const updated = selected.filter((v) => v !== val);
        onChange(updated.length === 0 ? "" : updated);
      } else {
        onChange([...selected, val]);
      }
    } else if (selected.includes(val)) {
      onChange("");
    } else {
      onChange(val);
      setSearch("");
      onDone?.();
    }
  }

  function addCustom() {
    const val = search.trim();
    if (!val) return;
    if (multiSelect) {
      if (!selected.includes(val)) onChange([...selected, val]);
    } else {
      onChange(val);
      onDone?.();
    }
    setSearch("");
  }

  return { search, setSearch, selected, filtered, isCustom, customValues, select, addCustom, clear: () => onChange(multiSelect ? [] : "") };
}

function pickDisplay(value) {
  const sel = Array.isArray(value) ? value : value ? [value] : [];
  return sel.length ? sel.join(", ") : null;
}

// Desktop item-specific picker: looks like a select, opens a searchable
// popover. Same behaviour as the app's existing picker.
export function SpecificPicker({ label, required, options = [], value, onChange, multiSelect = false, maxValues }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const searchRef = useRef(null);
  const st = usePickerState({ options, value, onChange, multiSelect, onDone: () => setOpen(false) });
  const shown = pickDisplay(value);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        st.setSearch("");
      }
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0">
      <span className="fl truncate">
        {label}
        {required && <span className="text-bad"> *</span>}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`pick ${open ? "border-accent" : ""}`}
        title={shown || undefined}
      >
        <span className={`truncate ${shown ? "" : "pick-empty"}`}>{shown || "—"}</span>
        <ChevronDownIcon className="size-[13px] shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="popup absolute left-0 right-0 z-30 mt-1 min-w-[220px] overflow-hidden">
          <div className="border-b border-line p-2">
            <input
              ref={searchRef}
              type="text"
              value={st.search}
              onChange={(e) => st.setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && st.isCustom) {
                  e.preventDefault();
                  st.addCustom();
                }
              }}
              placeholder="Search or add your own"
              className="input"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {st.selected.length > 0 && (
              <div className="flex items-center justify-between px-3 py-1">
                <span className="lbl text-xs">Selected</span>
                <button type="button" onClick={st.clear} className="text-sm font-medium text-accent">
                  Clear
                </button>
              </div>
            )}
            {st.isCustom && (
              <button
                type="button"
                onClick={st.addCustom}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-base text-accent hover:bg-accent-weak"
              >
                <PlusIcon className="size-3.5" />
                Add “{st.search.trim()}”
              </button>
            )}
            {[...st.customValues, ...st.filtered].map((opt) => {
              const on = st.selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => st.select(opt)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-base text-ink hover:bg-panel-2"
                >
                  <span className="min-w-0 truncate">{opt}</span>
                  {!options.includes(opt) && <span className="lbl text-2xs">Your own</span>}
                  {on && <CheckIcon className="size-3.5 shrink-0 text-accent" />}
                </button>
              );
            })}
            {st.filtered.length === 0 && !st.isCustom && st.customValues.length === 0 && (
              <p className="hint px-3 py-3 text-center">No options found</p>
            )}
          </div>
          {multiSelect && maxValues > 1 && (
            <p className="hint border-t border-line px-3 py-1.5">
              {st.selected.length} selected · eBay allows up to {maxValues} for this field.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Phone item-specific picker: a 74%-tall bottom sheet so the list starts
// under the thumb. Rows toggle; Done closes.
export function SpecificSheet({ open, onClose, label, options = [], value, onChange, multiSelect = false, maxValues }) {
  const st = usePickerState({ options, value, onChange, multiSelect, onDone: onClose });
  useEffect(() => {
    if (!open) st.setSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="scrim !items-end !p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet flex h-[74%] w-full max-w-[640px] flex-col px-2 pb-[18px] pt-2">
        <div className="grab" />
        <div className="flex items-center gap-2 px-1 pb-2.5">
          <div className="min-w-0 grow">
            <p className="lbl text-xs">Item specific</p>
            <p className="m-0 mt-0.5 truncate text-2xl font-semibold">{label}</p>
          </div>
          <button type="button" className="btn btn-touch shrink-0 px-3.5" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="px-1 pb-2.5">
          <input
            type="text"
            value={st.search}
            onChange={(e) => st.setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && st.isCustom) {
                e.preventDefault();
                st.addCustom();
              }
            }}
            className="input h-touch w-full rounded-panel text-lg"
            placeholder="Search or add your own"
            aria-label={`Search ${label} values`}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1">
          {st.isCustom && (
            <button type="button" className="orow text-accent" onClick={st.addCustom}>
              <PlusIcon className="size-4" />
              <span className="min-w-0 grow">Add “{st.search.trim()}”</span>
            </button>
          )}
          {[...st.customValues, ...st.filtered].map((opt) => {
            const on = st.selected.includes(opt);
            return (
              <button key={opt} type="button" className="orow" onClick={() => st.select(opt)}>
                <span className={`box ${on ? "box-on" : ""}`}>
                  <CheckIcon className="size-3" strokeWidth={3.2} />
                </span>
                <span className="min-w-0 grow">{opt}</span>
                {!options.includes(opt) && <span className="lbl text-2xs">Your own</span>}
              </button>
            );
          })}
          {st.filtered.length === 0 && !st.isCustom && st.customValues.length === 0 && (
            <p className="hint px-3 py-4 text-center">No options found</p>
          )}
        </div>
        {multiSelect && maxValues > 1 && (
          <p className="hint px-1.5 pt-2.5">
            {st.selected.length} selected · eBay allows up to {maxValues} for this field.
          </p>
        )}
      </div>
    </div>
  );
}

// Trigger button for the phone sheet.
export function PickButton({ label, required, value, onOpen }) {
  const shown = pickDisplay(value);
  return (
    <div className="min-w-0">
      <span className="fl truncate text-sm">
        {label}
        {required && <span className="text-bad"> *</span>}
      </span>
      <button type="button" className="pick h-touch w-full rounded-panel text-lg" onClick={onOpen}>
        <span className={`truncate ${shown ? "" : "pick-empty"}`}>{shown || "—"}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" />
      </button>
    </div>
  );
}

// A dismiss ✕ that inherits the colour of the strip it sits in.
export function DismissX({ onClick }) {
  return (
    <button type="button" className="x" aria-label="Dismiss" onClick={onClick}>
      <XIcon className="size-3" />
    </button>
  );
}

// "12 filled · 18 empty" helper.
export function isFilled(v) {
  return Array.isArray(v) ? v.length > 0 : !!String(v ?? "").trim();
}
