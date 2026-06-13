"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

// Map is client-only (Leaflet needs the DOM), loaded on demand.
const SourcingMap = dynamic(() => import("@/components/SourcingMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center rounded-lg border border-zinc-200 text-sm text-zinc-400 dark:border-zinc-800">
      Loading map…
    </div>
  ),
});

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    // Date-only string; append time to avoid TZ shifting the day back.
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// Pin/dot color by average items per visit:
//   > 7  green · 4–7 yellow · < 4 red · no visits yet = neutral gray
function dotClass(visits, ipv) {
  if (!visits) return "bg-zinc-300 dark:bg-zinc-600";
  if (ipv > 7) return "bg-green-500";
  if (ipv >= 4) return "bg-yellow-500";
  return "bg-red-500";
}

export default function SourcingPage() {
  const [stores, setStores] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null); // expanded store id
  const [view, setView] = useState("list"); // "list" | "map"
  // Modal state. storeModal = { id?, name, address }; tripModal = { storeId, date, bb, medium, high }
  const [storeModal, setStoreModal] = useState(null);
  const [tripModal, setTripModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sourcing", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setStores(data.stores || []);
        setTrips(data.trips || []);
      } else {
        setError(data.error || "Failed to load sourcing data");
      }
    } catch (err) {
      setError("Could not connect to sourcing service");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function persist(nextStores, nextTrips) {
    setSaving(true);
    setError("");
    // Optimistic — reflect immediately, then save.
    setStores(nextStores);
    setTrips(nextTrips);
    try {
      const res = await fetch("/api/sourcing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stores: nextStores, trips: nextTrips }),
      });
      const data = await res.json();
      if (data.success) {
        setStores(data.stores || []);
        setTrips(data.trips || []);
      } else {
        setError(data.error || "Save failed");
      }
    } catch (err) {
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // --- Store actions ---
  function openAddStore() {
    setStoreModal({ name: "", address: "" });
  }
  function openEditStore(store) {
    setStoreModal({ id: store.id, name: store.name, address: store.address || "" });
  }
  function saveStore() {
    const name = (storeModal.name || "").trim();
    if (!name) return;
    const address = (storeModal.address || "").trim();
    let nextStores;
    if (storeModal.id) {
      nextStores = stores.map((s) => {
        if (s.id !== storeModal.id) return s;
        // If the address changed, drop the old coordinates so the server
        // re-geocodes the new address on save.
        const addressChanged = (s.address || "") !== address;
        return {
          ...s,
          name,
          address,
          lat: addressChanged ? undefined : s.lat,
          lng: addressChanged ? undefined : s.lng,
        };
      });
    } else {
      nextStores = [
        ...stores,
        { id: newId(), name, address, createdAt: new Date().toISOString() },
      ];
    }
    persist(nextStores, trips);
    setStoreModal(null);
  }
  function deleteStore(id) {
    if (!confirm("Delete this store and all its logged trips? This cannot be undone.")) {
      return;
    }
    persist(
      stores.filter((s) => s.id !== id),
      trips.filter((t) => t.storeId !== id)
    );
  }

  // Clear every store's coordinates and re-save, so the server re-geocodes
  // them all from their addresses (e.g. after switching to a more accurate
  // geocoder). Trips are untouched.
  function relocateAll() {
    if (stores.length === 0) return;
    if (
      !confirm(
        "Re-locate all stores from their addresses? This re-geocodes every store."
      )
    ) {
      return;
    }
    const cleared = stores.map((s) => ({ ...s, lat: undefined, lng: undefined }));
    persist(cleared, trips);
  }

  // --- Trip actions ---
  function openLogTrip() {
    if (stores.length === 0) {
      setStoreModal({ name: "", address: "" });
      return;
    }
    // No default store — force an explicit pick so a trip can't be logged
    // to the wrong store by accident. (The per-store "+ Log a trip to X"
    // button pre-selects intentionally; this generic entry does not.)
    setTripModal({
      storeId: "",
      date: todayStr(),
      bb: "",
      medium: "",
      high: "",
    });
  }
  // Bump a tier count up/down via the stepper arrows (never below 0).
  // Functional updater so rapid taps don't fight a stale closure.
  function adjustTier(key, delta) {
    setTripModal((prev) => {
      if (!prev) return prev;
      const cur = Number(prev[key]) || 0;
      return { ...prev, [key]: String(Math.max(0, cur + delta)) };
    });
  }

  function saveTrip() {
    if (!tripModal.storeId) return;
    const trip = {
      id: newId(),
      storeId: tripModal.storeId,
      date: tripModal.date || todayStr(),
      bb: Number(tripModal.bb) || 0,
      medium: Number(tripModal.medium) || 0,
      high: Number(tripModal.high) || 0,
      createdAt: new Date().toISOString(),
    };
    persist(stores, [...trips, trip]);
    setTripModal(null);
  }
  function deleteTrip(id) {
    if (!confirm("Delete this trip?")) return;
    persist(stores, trips.filter((t) => t.id !== id));
  }

  // --- Stats (ranked by items per visit) ---
  const storeStats = stores
    .map((s) => {
      const st = trips
        .filter((t) => t.storeId === s.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      const visits = st.length;
      const bb = st.reduce((a, t) => a + (t.bb || 0), 0);
      const medium = st.reduce((a, t) => a + (t.medium || 0), 0);
      const high = st.reduce((a, t) => a + (t.high || 0), 0);
      const totalItems = bb + medium + high;
      const itemsPerVisit = visits ? totalItems / visits : 0;
      return { ...s, visits, bb, medium, high, totalItems, itemsPerVisit, tripList: st };
    })
    .sort((a, b) => b.itemsPerVisit - a.itemsPerVisit);

  const locatedCount = storeStats.filter(
    (s) => typeof s.lat === "number"
  ).length;
  const unlocated = storeStats.filter(
    (s) => s.address && s.address.trim() && typeof s.lat !== "number"
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Sourcing
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Log store trips and see which spots actually produce.
          </p>
        </div>
        {saving && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">Saving…</span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={openLogTrip}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Log Trip
        </button>
        <button
          onClick={openAddStore}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          + Add Store
        </button>
        {/* List / Map toggle */}
        <div className="ml-auto inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
          {["list", "map"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                view === v
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {error}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> 7+ / visit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> 4–7 / visit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> under 4 / visit
        </span>
      </div>

      {/* Body */}
      {loading ? (
        <div className="mt-12 flex justify-center">
          <svg className="h-8 w-8 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : view === "map" ? (
        <div className="mt-5">
          {storeStats.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No stores yet. Add a store with an address to see it on the map.
            </p>
          ) : (
            <>
              {unlocated.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  <span>
                    {unlocated.length} store{unlocated.length === 1 ? "" : "s"}{" "}
                    not on the map yet.
                  </span>
                  <button
                    onClick={() => persist(stores, trips)}
                    disabled={saving}
                    className="rounded bg-blue-600 px-2.5 py-1 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "Locating…" : "Locate on map"}
                  </button>
                </div>
              )}
              {locatedCount > 0 && (
                <div className="mb-2 flex justify-end">
                  <button
                    onClick={relocateAll}
                    disabled={saving}
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {saving ? "Re-locating…" : "Re-locate all pins"}
                  </button>
                </div>
              )}
              {locatedCount > 0 ? (
                <SourcingMap stores={storeStats} />
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No mapped stores yet — add an address, then tap “Locate on
                  map”.
                </p>
              )}
            </>
          )}
        </div>
      ) : storeStats.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No stores yet. Add a store, then log your trips to it.
          </p>
          <button
            onClick={openAddStore}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Store
          </button>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {storeStats.map((s) => {
            const isOpen = expanded === s.id;
            // Quality mix with each tier's share of total items. When the
            // store has visits but 0 items (all misses), show counts only.
            const pc = (n) => Math.round((n / s.totalItems) * 100);
            const mix = s.totalItems
              ? `${s.bb} B&B (${pc(s.bb)}%) · ${s.medium} Med (${pc(s.medium)}%) · ${s.high} High (${pc(s.high)}%)`
              : `${s.bb} B&B · ${s.medium} Med · ${s.high} High`;
            return (
              <li
                key={s.id}
                className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                {/* Card header */}
                <div className="flex items-center gap-3 p-3">
                  <span
                    className={`h-3 w-3 flex-shrink-0 rounded-full ${dotClass(s.visits, s.itemsPerVisit)}`}
                    title={s.visits ? `${s.itemsPerVisit.toFixed(1)} items/visit` : "No visits yet"}
                  />
                  <button
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {s.name}
                    </p>
                    {s.address && (
                      <p className="truncate text-xs text-zinc-400 dark:text-zinc-500">
                        {s.address}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {s.visits === 0 ? (
                        "No visits yet"
                      ) : (
                        <>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {s.totalItems} items
                          </span>{" "}
                          · {s.visits} visit{s.visits === 1 ? "" : "s"} ·{" "}
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {s.itemsPerVisit.toFixed(1)}/visit
                          </span>
                        </>
                      )}
                    </p>
                    {s.visits > 0 && (
                      <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                        {mix}
                      </p>
                    )}
                  </button>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={() => openEditStore(s)}
                      aria-label="Edit store"
                      title="Edit store"
                      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteStore(s.id)}
                      aria-label="Delete store"
                      title="Delete store"
                      className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded trip list */}
                {isOpen && (
                  <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
                    {s.tripList.length === 0 ? (
                      <p className="py-1 text-xs text-zinc-400 dark:text-zinc-500">
                        No trips logged yet.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {s.tripList.map((t) => (
                          <li
                            key={t.id}
                            className="flex items-center justify-between gap-2 py-1 text-xs"
                          >
                            <span className="text-zinc-600 dark:text-zinc-300">
                              {fmtDate(t.date)} —{" "}
                              <span className="font-medium">
                                {(t.bb || 0) + (t.medium || 0) + (t.high || 0)} items
                              </span>{" "}
                              <span className="text-zinc-400 dark:text-zinc-500">
                                ({t.bb || 0} B&amp;B · {t.medium || 0} Med · {t.high || 0} High)
                              </span>
                            </span>
                            <button
                              onClick={() => deleteTrip(t.id)}
                              aria-label="Delete trip"
                              className="rounded px-1.5 py-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      onClick={() =>
                        setTripModal({
                          storeId: s.id,
                          date: todayStr(),
                          bb: "",
                          medium: "",
                          high: "",
                        })
                      }
                      className="mt-2 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      + Log a trip to {s.name}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* --- Store add/edit modal --- */}
      {storeModal && (
        <div
          className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setStoreModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {storeModal.id ? "Edit Store" : "Add Store"}
            </h2>
            <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Store name
            </label>
            <input
              autoFocus
              type="text"
              value={storeModal.name}
              onChange={(e) => setStoreModal({ ...storeModal, name: e.target.value })}
              placeholder="Goodwill on Main St"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Address <span className="text-zinc-400">(for the map, later)</span>
            </label>
            <input
              type="text"
              value={storeModal.address}
              onChange={(e) => setStoreModal({ ...storeModal, address: e.target.value })}
              placeholder="123 Main St, Lafayette, IN"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setStoreModal(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={saveStore}
                disabled={!storeModal.name.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Trip log modal --- */}
      {tripModal && (
        <div
          className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setTripModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Log Trip
            </h2>

            <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Store
            </label>
            <select
              value={tripModal.storeId}
              onChange={(e) => setTripModal({ ...tripModal, storeId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">Select a store…</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Date
            </label>
            <input
              type="date"
              value={tripModal.date}
              max={todayStr()}
              onChange={(e) => setTripModal({ ...tripModal, date: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />

            <p className="mt-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Items bought (leave blank or 0 for a miss)
            </p>
            {/* Stacked + large on mobile (full width per tier); the desktop
                3-across compact layout is preserved via md: overrides. */}
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-2">
              {[
                { key: "bb", label: "Bread & Butter" },
                { key: "medium", label: "Medium" },
                { key: "high", label: "High" },
              ].map((tier) => (
                <div key={tier.key}>
                  <label className="block text-xs text-zinc-500 md:text-[11px] dark:text-zinc-400">
                    {tier.label}
                  </label>
                  <div className="mt-1 flex items-stretch gap-1.5 md:gap-1">
                    {/* Typeable box — keyboard still works if you tap it */}
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={tripModal[tier.key]}
                      onChange={(e) =>
                        setTripModal({ ...tripModal, [tier.key]: e.target.value })
                      }
                      placeholder="0"
                      className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-4 text-center text-xl font-semibold text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 md:px-2 md:py-2 md:text-sm md:font-normal dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    {/* Stepper — tap to add/remove one without the keyboard */}
                    <div className="flex flex-shrink-0 flex-col">
                      <button
                        type="button"
                        onClick={() => adjustTier(tier.key, 1)}
                        aria-label={`Add one ${tier.label}`}
                        className="flex w-14 flex-1 items-center justify-center rounded-t-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 md:w-7 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <svg className="h-6 w-6 md:h-3.5 md:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustTier(tier.key, -1)}
                        aria-label={`Remove one ${tier.label}`}
                        className="flex w-14 flex-1 items-center justify-center rounded-b-lg border border-t-0 border-zinc-300 text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 md:w-7 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <svg className="h-6 w-6 md:h-3.5 md:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setTripModal(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={saveTrip}
                disabled={!tripModal.storeId}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
