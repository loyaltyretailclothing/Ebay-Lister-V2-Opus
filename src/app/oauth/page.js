"use client";

import { useState, useEffect } from "react";
import SettingsShell from "@/components/settings/SettingsShell";
import { CheckIcon, CopyIcon, ExternalIcon, Spinner } from "@/components/ui/Icons";

const EBAY_AUTH_URL = "https://auth.ebay.com/oauth2/authorize";
const CLIENT_ID = "AaronHea-listerte-PRD-94c591791-ddad0e23";
const RUNAME = "Aaron_Heath-AaronHea-lister-nczpfnsjr";
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

// Settings → eBay Account: the one-time 3-step connection, now inside
// Settings (it used to replace the screen and lose the Settings navigation).
// eBay sends the user back to this page (/oauth) with ?code=… in the URL.
export default function OAuthPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Check URL for code parameter (eBay redirect)
  useEffect(() => {
    const authCode = new URLSearchParams(window.location.search).get("code");
    if (authCode) setCode(authCode);
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
      if (data.success) setResult(data);
      else setError(data.error || "Exchange failed");
    } catch {
      setError("Could not exchange code");
    } finally {
      setLoading(false);
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(result.refresh_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the field is selectable instead.
    }
  }

  // The step NUMBER carries the state; the rows never change colour.
  const step = result ? 3 : code ? 2 : 1;
  const marker = (n) => (
    <span className={`step-n ${n < step ? "step-done" : n === step ? "step-now" : ""}`}>
      {n < step ? <CheckIcon className="size-3" strokeWidth={3} /> : n}
    </span>
  );

  return (
    <SettingsShell active="account">
      {({ touch }) => (
        <div className={`flex flex-col gap-3.5 ${touch ? "" : "max-w-[640px]"}`}>
          <p className="hint">
            A one-time setup. Do it once per eBay account; the app refreshes the token on its own after
            that.
          </p>
          <div className="card overflow-hidden">
            <div className="steprow">
              {marker(1)}
              <span className="min-w-0 grow">
                <span className="steptitle">Authorize with eBay</span>
                <span className="hint mt-[3px] block">
                  Sign in to eBay as the selling account and grant access. eBay sends you back here
                  with a code.
                </span>
                <span className="mt-[9px] block">
                  <a href={authUrl} className={`btn btn-primary no-underline ${touch ? "btn-touch" : ""}`}>
                    Authorize with eBay
                    <ExternalIcon className="size-3.5" />
                  </a>
                </span>
              </span>
            </div>

            <div className="steprow">
              {marker(2)}
              <span className="min-w-0 grow">
                <span className="steptitle">Exchange the code</span>
                <span className="hint mt-[3px] block">
                  After eBay sends you back, the code fills in here. Then press Exchange.
                </span>
                <span className="mt-[9px] flex gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Authorization code (fills in after sign-in)"
                    className={`input min-w-0 flex-1 ${touch ? "h-touch rounded-panel text-lg" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={exchangeCode}
                    disabled={!code || loading}
                    className={`btn btn-primary shrink-0 ${touch ? "btn-touch" : ""}`}
                  >
                    {loading && <Spinner className="size-3.5" />}
                    {loading ? "Exchanging…" : "Exchange"}
                  </button>
                </span>
                {error && <span className="mt-2 block text-md font-medium text-bad">{error}</span>}
              </span>
            </div>

            <div className="steprow">
              {marker(3)}
              <span className="min-w-0 grow">
                <span className="steptitle">Copy the refresh token</span>
                <span className="hint mt-[3px] block">
                  Paste it into your <code>.env.local</code> file (and Vercel) as{" "}
                  <code>EBAY_OAUTH_REFRESH_TOKEN</code>, wrapped in double quotes.
                  {result?.refresh_token_expires_in
                    ? ` It expires in ${Math.round(result.refresh_token_expires_in / 86400)} days.`
                    : ""}
                </span>
                <span className="mt-[9px] flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={result?.refresh_token || ""}
                    onClick={(e) => e.target.select()}
                    className={`input mono min-w-0 flex-1 border-ro-line bg-ro text-base text-ink-2 ${touch ? "h-touch rounded-panel" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={copyToken}
                    disabled={!result?.refresh_token}
                    className={`btn shrink-0 ${touch ? "btn-touch" : ""}`}
                  >
                    {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
