import { EBAY_BASE_URL, EBAY_AUTH_URL } from "./constants";

let cachedAppToken = null;
let appTokenExpiry = 0;

let cachedUserToken = null;
let userTokenExpiry = 0;

// Application token (client credentials) — for public APIs (Browse, Taxonomy, Metadata)
export async function getAppToken() {
  if (cachedAppToken && Date.now() < appTokenExpiry) {
    return cachedAppToken;
  }

  const credentials = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(EBAY_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`eBay app token failed: ${error}`);
  }

  const data = await res.json();
  cachedAppToken = data.access_token;
  // Expire 5 minutes early
  appTokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

  return cachedAppToken;
}

// User token (refresh token grant) — for sell/inventory APIs (Phase 5)
export async function getUserToken() {
  if (cachedUserToken && Date.now() < userTokenExpiry) {
    return cachedUserToken;
  }

  const refreshToken = process.env.EBAY_OAUTH_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("No eBay user refresh token configured");
  }

  const credentials = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(EBAY_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: [
        "https://api.ebay.com/oauth/api_scope",
        "https://api.ebay.com/oauth/api_scope/sell.inventory",
        "https://api.ebay.com/oauth/api_scope/sell.marketing",
        "https://api.ebay.com/oauth/api_scope/sell.account",
        "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
      ].join(" "),
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`eBay user token refresh failed: ${error}`);
  }

  const data = await res.json();
  cachedUserToken = data.access_token;
  userTokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

  return cachedUserToken;
}

// Backward-compatible helper — defaults to app token
export async function getAccessToken() {
  return getAppToken();
}

export async function ebayRequest(path, options = {}) {
  // Use user token for sell APIs, app token for everything else
  const needsUserToken = path.startsWith("/sell/");
  const token = needsUserToken ? await getUserToken() : await getAppToken();
  const url = `${EBAY_BASE_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`eBay API error (${res.status}): ${error}`);
  }

  if (res.status === 204) return null;
  return res.json();
}
