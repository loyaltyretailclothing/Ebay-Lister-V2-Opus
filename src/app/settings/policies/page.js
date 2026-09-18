"use client";

import { useState, useEffect } from "react";
import SettingsShell from "@/components/settings/SettingsShell";
import Dialog from "@/components/ui/Dialog";
import { PlusIcon, Spinner, StarIcon, TrashIcon } from "@/components/ui/Icons";

const GROUPS = [
  { type: "payment", title: "Payment" },
  { type: "shipping", title: "Shipping" },
  { type: "return", title: "Return" },
];
const defaultKey = (type) => `default${type.charAt(0).toUpperCase() + type.slice(1)}`;

// Settings → Policies. Three fixed groups (eBay's). Each row: the default
// star (exactly one per group — you set it by pressing it), the label, the
// eBay policy ID, and Remove (with a confirm). Edits save when a field is
// left; add, remove and star save straight away.
export default function PoliciesPage() {
  const [policies, setPolicies] = useState({
    payment: [],
    shipping: [],
    return: [],
    defaultPayment: "",
    defaultShipping: "",
    defaultReturn: "",
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [removeAt, setRemoveAt] = useState(null); // { type, index }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const data = await res.json();
        if (data.success && data.policies) {
          const p = data.policies;
          // Migrate old single-object format to array format
          const payment = Array.isArray(p.payment) ? p.payment : p.payment?.id ? [p.payment] : [];
          const shipping = Array.isArray(p.shipping) ? p.shipping : [];
          const returnPolicies = Array.isArray(p.return) ? p.return : p.return?.id ? [p.return] : [];
          setPolicies({
            payment,
            shipping,
            return: returnPolicies,
            defaultPayment: p.defaultPayment || (payment.length > 0 ? payment[0].id : ""),
            defaultShipping: p.defaultShipping || (shipping.length > 0 ? shipping[0].id : ""),
            defaultReturn: p.defaultReturn || (returnPolicies.length > 0 ? returnPolicies[0].id : ""),
          });
        }
      } catch (err) {
        console.error("Failed to load policies:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(updated) {
    setStatus("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policies: updated }),
      });
      const result = await res.json();
      setStatus(result.success ? "Saved" : "Save failed");
      setTimeout(() => setStatus(""), 2000);
    } catch {
      setStatus("Save failed");
    }
  }

  function change(type, list, defaultId, persist = true) {
    const updated = { ...policies, [type]: list, [defaultKey(type)]: defaultId };
    setPolicies(updated);
    if (persist) save(updated);
  }

  function confirmRemove() {
    const { type, index } = removeAt;
    setRemoveAt(null);
    const list = policies[type];
    const removed = list[index];
    const next = list.filter((_, i) => i !== index);
    let def = policies[defaultKey(type)];
    if (removed.id === def) def = next.length > 0 ? next[0].id : "";
    change(type, next, def);
  }

  return (
    <SettingsShell active="policies">
      {({ touch }) =>
        loading ? (
          <p className="hint flex items-center gap-2 py-4">
            <Spinner className="size-3.5" /> Loading…
          </p>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-start gap-3">
              <p className={`hint ${touch ? "" : "max-w-[640px]"}`}>
                The starred policy in each group is the one a new listing starts with. Policy IDs come
                from eBay; the label is yours.
              </p>
              <div className="grow" />
              {status && (
                <span className={`shrink-0 text-sm font-medium ${status === "Saved" ? "text-ok" : "text-bad"}`}>{status}</span>
              )}
            </div>

            {GROUPS.map(({ type, title }) => {
              const list = policies[type] || [];
              const def = policies[defaultKey(type)];
              return (
                <div key={type} className="card">
                  <div className="grouphead">
                    <h2 className="lbl">{title}</h2>
                    <span className="mono text-sm text-ink-3">
                      {list.length} polic{list.length === 1 ? "y" : "ies"}
                    </span>
                    <div className="grow" />
                    <button
                      type="button"
                      className={touch ? "btn h-9 px-3" : "btn btn-sm"}
                      onClick={() => change(type, [...list, { id: "", label: "" }], def)}
                    >
                      <PlusIcon className="size-[13px]" />
                      Add
                    </button>
                  </div>
                  {list.length === 0 && <p className="hint px-3 py-2.5">No policies added yet.</p>}
                  {list.map((p, i) => {
                    const isDefault = !!p.id && p.id === def;
                    const update = (field, value) => {
                      const next = [...list];
                      next[i] = { ...next[i], [field]: value };
                      // A changed ID that was the default stays the default.
                      const nextDef = field === "id" && def === p.id ? value : def;
                      change(type, next, nextDef, false);
                    };
                    return (
                      <div key={i} className={`polrow ${touch ? "polrow-touch" : ""}`}>
                        <button
                          type="button"
                          className={`star ${isDefault ? "star-on" : ""}`}
                          aria-label={isDefault ? "Default policy" : "Make default"}
                          aria-pressed={isDefault}
                          disabled={!p.id}
                          onClick={() => p.id && change(type, list, p.id)}
                        >
                          <StarIcon filled={isDefault} />
                        </button>
                        <input
                          type="text"
                          value={p.label}
                          onChange={(e) => update("label", e.target.value)}
                          onBlur={() => save(policies)}
                          placeholder="Label (yours)"
                          aria-label="Policy label"
                          className={`pollabel input ${touch ? "h-9" : ""}`}
                        />
                        <input
                          type="text"
                          value={p.id}
                          onChange={(e) => update("id", e.target.value.trim())}
                          onBlur={() => save(policies)}
                          placeholder="eBay policy ID"
                          aria-label="eBay policy ID"
                          className={`polid input mono ${touch ? "h-9" : ""}`}
                        />
                        <button
                          type="button"
                          className="btn btn-dq polremove"
                          aria-label={`Remove policy ${p.label || p.id}`}
                          onClick={() => setRemoveAt({ type, index: i })}
                        >
                          <TrashIcon className="size-[15px]" />
                          <span className="polremove-txt">Remove</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <Dialog
              open={!!removeAt}
              onCancel={() => setRemoveAt(null)}
              title="Remove this?"
              touch={touch}
              actions={
                <>
                  <button type="button" className={touch ? "btn btn-touch flex-1" : "btn"} onClick={() => setRemoveAt(null)}>
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
