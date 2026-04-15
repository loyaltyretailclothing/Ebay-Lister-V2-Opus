"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function EbaySettingsContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const token = searchParams.get("token");
  const expires = searchParams.get("expires");
  const error = searchParams.get("error");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        eBay Account
      </h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <p className="font-medium text-red-800 dark:text-red-300">
            Connection failed
          </p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        </div>
      )}

      {success && token && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
          <p className="font-medium text-green-800 dark:text-green-300">
            eBay account connected successfully!
          </p>
          <p className="mt-1 text-sm text-green-600 dark:text-green-400">
            Token expires: {expires}
          </p>
          <div className="mt-3">
            <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Refresh Token:
            </p>
            <div className="relative">
              <textarea
                readOnly
                value={token}
                rows={4}
                className="w-full rounded-md border border-zinc-300 bg-white p-2 font-mono text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(token);
                  alert("Token copied to clipboard!");
                }}
                className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Copy Token
              </button>
            </div>
            <div className="mt-3 rounded-md bg-amber-50 p-3 dark:bg-amber-950/30">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Next steps:
              </p>
              <ol className="mt-1 list-inside list-decimal space-y-1 text-sm text-amber-700 dark:text-amber-400">
                <li>Copy the token above</li>
                <li>
                  Go to Vercel → Project Settings → Environment Variables
                </li>
                <li>
                  Update <code className="font-mono">EBAY_OAUTH_REFRESH_TOKEN</code> with this token
                </li>
                <li>Redeploy the app</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {!success && !error && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Connect your eBay seller account to enable listing submissions.
            This will request permission to manage your inventory, marketing,
            and fulfillment on eBay.
          </p>
          <a
            href="/api/ebay/auth"
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Connect eBay Account
          </a>
        </div>
      )}
    </div>
  );
}

export default function EbaySettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            eBay Account
          </h1>
          <p className="mt-4 text-zinc-500">Loading...</p>
        </div>
      }
    >
      <EbaySettingsContent />
    </Suspense>
  );
}
