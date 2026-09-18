"use client";

import { useState, useEffect } from "react";
import SettingsShell from "@/components/settings/SettingsShell";
import Dialog from "@/components/ui/Dialog";
import { ChevronRightIcon, SearchIcon, Spinner } from "@/components/ui/Icons";

// Top-down path ("Clothing, Shoes & Accessories > Men > … > Polos"). eBay
// lists ancestors nearest-first.
function pathOf(cat) {
  return [...(cat.ancestors || [])].reverse().concat(cat.name).join(" > ");
}

// Settings → Categories. Search eBay, tap a result to add it, and mark which
// item specifics allow more than one value. Every change is sent as a change
// to ONE category, so nothing here can wipe the other saved categories.
export default function CategoriesPage() {
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [status, setStatus] = useState("");
  const [removeId, setRemoveId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const data = await res.json();
        if (data.success) setCategories(data.categories || {});
        else setLoadError("Couldn't load categories");
      } catch {
        setLoadError("Couldn't load categories");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function send(body) {
    setStatus("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        // Take the server's list after an add/remove (it may include another
        // user's changes). Tick changes keep the local state, so quick
        // clicks can't be undone by an older response arriving late.
        if (data.categories && !body.setCategory) setCategories(data.categories);
        setStatus("Saved");
        setTimeout(() => setStatus(""), 2000);
        return true;
      }
      setStatus(data.error ? `Save failed: ${data.error}` : "Save failed");
    } catch {
      setStatus("Save failed");
    }
    return false;
  }

  async function handleSearch() {
    if (!searchQuery.trim() || searching) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/ebay/categories?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.success ? data.categories || [] : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function addCategory(cat) {
    if (categories[cat.id]) {
      setExpanded(cat.id);
      setSearchResults(null);
      setSearchQuery("");
      return;
    }
    setAdding(cat.id);
    try {
      const res = await fetch(`/api/ebay/specifics?categoryId=${cat.id}`);
      const data = await res.json();
      if (data.success) {
        const specifics = {};
        for (const spec of data.specifics) {
          specifics[spec.name] = {
            localizedName: spec.localizedName,
            multiSelect: false,
            required: spec.required,
            hasValues: spec.values.length > 0,
          };
        }
        const ok = await send({
          addCategory: { id: cat.id, config: { name: cat.name, path: pathOf(cat), specifics } },
        });
        if (ok) {
          setExpanded(cat.id);
          setSearchResults(null);
          setSearchQuery("");
        }
      } else {
        setStatus("Couldn't load that category's item specifics");
      }
    } catch {
      setStatus("Couldn't load that category's item specifics");
    } finally {
      setAdding(null);
    }
  }

  function toggleMulti(catId, name) {
    const cat = categories[catId];
    const config = {
      ...cat,
      specifics: {
        ...cat.specifics,
        [name]: { ...cat.specifics[name], multiSelect: !cat.specifics[name].multiSelect },
      },
    };
    setCategories((prev) => ({ ...prev, [catId]: config }));
    send({ setCategory: { id: catId, config } });
  }

  async function confirmRemove() {
    const id = removeId;
    setRemoveId(null);
    if (expanded === id) setExpanded(null);
    await send({ removeCategory: id });
  }

  const ids = Object.keys(categories);

  return (
    <SettingsShell active="categories">
      {({ touch }) =>
        loading ? (
          <p className="hint flex items-center gap-2 py-4">
            <Spinner className="size-3.5" /> Loading…
          </p>
        ) : (
          <div className="flex flex-col gap-[18px]">
            {loadError && <p className="m-0 font-medium text-bad">{loadError}</p>}
            <div>
              <h2 className="lbl mb-[7px]">Add a category</h2>
              <div className={`flex gap-2 ${touch ? "" : "max-w-[640px]"}`}>
                <span className="relative min-w-0 flex-1">
                  <SearchIcon className="pointer-events-none absolute left-[11px] top-1/2 size-[15px] -translate-y-1/2 text-ink-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search eBay categories"
                    className={`input w-full ${touch ? "h-touch rounded-panel pl-9 text-lg" : "pl-8"}`}
                  />
                </span>
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className={`btn btn-primary min-w-[104px] shrink-0 ${touch ? "btn-touch" : ""}`}
                >
                  {searching && <Spinner className="size-3.5" />}
                  {searching ? "Searching…" : "Search"}
                </button>
              </div>
              {searchResults && (
                <>
                  <div className={`card mt-1.5 overflow-hidden ${touch ? "" : "max-w-[640px]"}`}>
                    {searchResults.length === 0 && <p className="hint px-3 py-2.5">No categories found.</p>}
                    {searchResults.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`resrow last:border-b-0 ${touch ? "min-h-touch text-md" : ""}`}
                        disabled={adding === cat.id}
                        onClick={() => addCategory(cat)}
                      >
                        <span className="min-w-0 grow truncate">{pathOf(cat)}</span>
                        {adding === cat.id ? (
                          <Spinner className="size-3.5 shrink-0 text-ink-3" />
                        ) : categories[cat.id] ? (
                          <span className="shrink-0 text-sm font-medium text-ok">Added</span>
                        ) : (
                          <span className="mono shrink-0 text-sm text-ink-3">{cat.id}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {searchResults.length > 0 && <p className="hint mt-1.5">Tap a result to add it.</p>}
                </>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="lbl">Saved categories</h2>
                <span className="mono text-sm text-ink-3">{ids.length} saved</span>
                <div className="grow" />
                {status && (
                  <span className={`text-sm font-medium ${status === "Saved" ? "text-ok" : "text-bad"}`}>{status}</span>
                )}
              </div>
              {ids.length === 0 && <p className="hint">No categories added yet. Search above to add one.</p>}
              <div className="flex flex-col gap-2">
                {ids.map((id) => {
                  const cat = categories[id];
                  const entries = Object.entries(cat.specifics || {});
                  const multi = entries.filter(([, s]) => s.multiSelect).length;
                  const open = expanded === id;
                  return (
                    <div key={id} className="card">
                      <div className="cathead">
                        <button
                          type="button"
                          className="catbtn"
                          aria-expanded={open}
                          onClick={() => setExpanded(open ? null : id)}
                        >
                          <ChevronRightIcon
                            className={`size-3.5 shrink-0 text-ink-3 transition-transform ${open ? "rotate-90" : ""}`}
                            strokeWidth={2.2}
                          />
                          <span className="min-w-0 grow">
                            <span className="cattitle">{cat.path && cat.path !== cat.name ? cat.path : cat.name}</span>
                            <span className="hint mt-0.5 block">
                              {entries.length} item specifics, {multi} allow more than one value
                            </span>
                          </span>
                          {!touch && <span className="mono shrink-0 text-sm text-ink-3">{id}</span>}
                        </button>
                        <button type="button" className={`btn btn-dq ${touch ? "btn-touch" : ""}`} onClick={() => setRemoveId(id)}>
                          Remove
                        </button>
                      </div>
                      {open && (
                        <div className="catbody">
                          <p className="hint mb-2.5">Tick the item specifics eBay lets you give more than one value.</p>
                          <div className={`specgrid ${touch ? "specgrid-touch" : ""}`}>
                            {entries.map(([name, spec]) => (
                              <label key={name} className={`speccheck ${touch ? "min-h-touch text-lg" : ""}`}>
                                <input type="checkbox" checked={!!spec.multiSelect} onChange={() => toggleMulti(id, name)} />
                                <span>
                                  {spec.localizedName || name}
                                  {spec.required && <span className="text-bad"> *</span>}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Dialog
              open={!!removeId}
              onCancel={() => setRemoveId(null)}
              title="Remove this?"
              touch={touch}
              actions={
                <>
                  <button type="button" className={touch ? "btn btn-touch flex-1" : "btn"} onClick={() => setRemoveId(null)}>
                    Cancel
                  </button>
                  <button type="button" className={`${touch ? "btn btn-touch flex-1" : "btn"} btn-danger`} onClick={confirmRemove}>
                    Remove
                  </button>
                </>
              }
            >
              <p className="hint mt-1.5">It goes from Settings only. Listings already using it are untouched.</p>
            </Dialog>
          </div>
        )
      }
    </SettingsShell>
  );
}
