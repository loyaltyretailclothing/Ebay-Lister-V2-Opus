"use client";

import { useState, useEffect } from "react";

function PolicySection({ title, policies, defaultId, onUpdate }) {
  function add() {
    onUpdate([...policies, { id: "", label: "" }], defaultId);
  }

  function update(index, field, value) {
    const updated = [...policies];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate(updated, defaultId);
  }

  function remove(index) {
    const removed = policies[index];
    const updated = policies.filter((_, i) => i !== index);
    // If we removed the default, clear it or pick first
    let newDefault = defaultId;
    if (removed.id === defaultId) {
      newDefault = updated.length > 0 ? updated[0].id : "";
    }
    onUpdate(updated, newDefault);
  }

  function setDefault(id) {
    onUpdate(policies, id);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {title}
        </h2>
        <button
          onClick={add}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          + Add
        </button>
      </div>
      {policies.length === 0 && (
        <p className="mt-3 text-sm text-zinc-400">
          No policies added yet.
        </p>
      )}
      <div className="mt-3 space-y-3">
        {policies.map((p, i) => {
          const isFav = p.id && p.id === defaultId;
          return (
            <div key={i} className="flex items-end gap-3">
              {/* Favorite star */}
              <button
                type="button"
                onClick={() => p.id && setDefault(p.id)}
                title={isFav ? "Default policy" : "Set as default"}
                className={`mb-1.5 flex-shrink-0 ${
                  isFav
                    ? "text-yellow-500"
                    : "text-zinc-300 hover:text-yellow-400 dark:text-zinc-600"
                }`}
              >
                <svg
                  className="h-5 w-5"
                  fill={isFav ? "currentColor" : "none"}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </button>
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Policy ID
                </label>
                <input
                  type="text"
                  value={p.id}
                  onChange={(e) => update(i, "id", e.target.value)}
                  placeholder="eBay policy ID"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Label
                </label>
                <input
                  type="text"
                  value={p.label}
                  onChange={(e) => update(i, "label", e.target.value)}
                  placeholder="Friendly name"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <button
                onClick={() => remove(i)}
                className="mb-0.5 rounded px-2 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  const [saveStatus, setSaveStatus] = useState("");
  const saveTimer = useState(null)[1];

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.success && data.policies) {
          const p = data.policies;
          // Migrate old single-object format to array format
          const payment = Array.isArray(p.payment)
            ? p.payment
            : p.payment?.id
              ? [p.payment]
              : [];
          const shipping = Array.isArray(p.shipping) ? p.shipping : [];
          const returnPolicies = Array.isArray(p.return)
            ? p.return
            : p.return?.id
              ? [p.return]
              : [];

          setPolicies({
            payment,
            shipping,
            return: returnPolicies,
            defaultPayment:
              p.defaultPayment || (payment.length > 0 ? payment[0].id : ""),
            defaultShipping:
              p.defaultShipping ||
              (shipping.length > 0 ? shipping[0].id : ""),
            defaultReturn:
              p.defaultReturn ||
              (returnPolicies.length > 0 ? returnPolicies[0].id : ""),
          });
        }
      } catch (err) {
        console.error("Failed to load policies:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function save(updated) {
    setSaveStatus("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policies: updated }),
      });
      const result = await res.json();
      setSaveStatus(result.success ? "Saved" : "Save failed");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch {
      setSaveStatus("Save failed");
    }
  }

  // Debounced save on blur
  function handleBlur() {
    save(policies);
  }

  function updatePolicyType(type, list, defaultId) {
    const defaultKey = `default${type.charAt(0).toUpperCase() + type.slice(1)}`;
    const updated = { ...policies, [type]: list, [defaultKey]: defaultId };
    setPolicies(updated);
    save(updated);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm text-zinc-400">Loading policies...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Policies
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your eBay business policies. Star a policy to set it as the
            default for new listings.
          </p>
        </div>
        {saveStatus && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              saveStatus === "Saved"
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
            }`}
          >
            {saveStatus}
          </span>
        )}
      </div>

      <div className="mt-6 space-y-6">
        <PolicySection
          title="Payment Policies"
          policies={policies.payment}
          defaultId={policies.defaultPayment}
          onUpdate={(list, defId) => updatePolicyType("payment", list, defId)}
        />

        <PolicySection
          title="Shipping Policies"
          policies={policies.shipping}
          defaultId={policies.defaultShipping}
          onUpdate={(list, defId) => updatePolicyType("shipping", list, defId)}
        />

        <PolicySection
          title="Return Policies"
          policies={policies.return}
          defaultId={policies.defaultReturn}
          onUpdate={(list, defId) => updatePolicyType("return", list, defId)}
        />

      </div>
    </div>
  );
}
