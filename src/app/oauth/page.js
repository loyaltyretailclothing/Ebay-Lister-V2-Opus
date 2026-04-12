"use client";

import { useState, useEffect } from "react";

const EBAY_AUTH_URL = "https://auth.ebay.com/oauth2/authorize";
const CLIENT_ID = "AaronHea-listerte-PRD-94c591791-ddad0e23";
const RUNAME = "Aaron_Heath-AaronHea-lister-ismayclex";
const SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.marketing.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.marketing",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.finances",
  "https://api.ebay.com/oauth/api_scope/sell.payment.dispute",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
].join(" ");

export default function OAuthPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check URL for code parameter (eBay redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("code");
    if (authCode) {
      setCode(authCode);
    }
  }, []);

  const authUrl = `${EBAY_AUTH_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${RUNAME}&scope=${encodeURIComponent(SCOPES)}`;

  async function exchangeCode() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ebay/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "Exchange failed");
      }
    } catch (err) {
      setError("Could not exchange code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        eBay OAuth Setup
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        One-time setup to connect your eBay account.
      </p>

      {/* Step 1 */}
      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
          Step 1: Sign in to eBay
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Click the button below. Sign into eBay and grant access. You'll be
          redirected back here automatically.
        </p>
        <a
          href={authUrl}
          className="mt-3 inline-block rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Authorize with eBay
        </a>
      </div>

      {/* Step 2 */}
      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
          Step 2: Exchange the code
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          After eBay redirects you back, the code will auto-fill below. Just
          click Exchange.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Authorization code (auto-fills after sign-in)"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            onClick={exchangeCode}
            disabled={!code || loading}
            className={`rounded-lg px-5 py-2 text-sm font-medium text-white ${
              code && !loading
                ? "bg-blue-600 hover:bg-blue-700"
                : "cursor-not-allowed bg-blue-600 opacity-50"
            }`}
          >
            {loading ? "Exchanging..." : "Exchange"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Step 3 — Result */}
      {result && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950">
          <h2 className="font-medium text-green-900 dark:text-green-100">
            Step 3: Copy your refresh token
          </h2>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            Copy this token and paste it into your <code>.env.local</code> file
            as <code>EBAY_OAUTH_REFRESH_TOKEN</code>. Wrap it in double quotes.
          </p>
          <textarea
            readOnly
            value={result.refresh_token}
            rows={4}
            className="mt-3 w-full rounded-lg border border-green-300 bg-white p-3 font-mono text-xs text-zinc-900 dark:border-green-700 dark:bg-zinc-800 dark:text-zinc-100"
            onClick={(e) => e.target.select()}
          />
          <p className="mt-2 text-xs text-green-600 dark:text-green-400">
            This token expires in{" "}
            {Math.round(result.refresh_token_expires_in / 86400)} days.
          </p>
        </div>
      )}
    </div>
  );
}
