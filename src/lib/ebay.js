import { EBAY_BASE_URL, EBAY_AUTH_URL, EBAY_MEDIA_BASE_URL } from "./constants";

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

// ---------------------------------------------------------------------------
// eBay Media API — upload photos to EPS so we hand eBay back its own URLs
// in the Inventory API call. Eliminates the long-term dependency on the
// source URL (e.g. Cloudinary) staying alive for revisions/re-ingestion.
//
// Two-step flow per photo:
//   1. POST create_image_from_url with the source URL — eBay fetches the
//      bytes and stores them on EPS, returns image_id in the Location
//      header (URI format: .../image/{image_id}).
//   2. GET image/{image_id} — returns the actual i.ebayimg.com EPS URL
//      that we then use as the imageUrl in the Inventory API.
//
// Requires sell.inventory OAuth scope (already on our refresh token).
// Rate limit: 50 POST requests per 5 seconds per user — uploads can be
// parallelized safely for typical listing sizes.
// ---------------------------------------------------------------------------

export async function uploadPhotoToEps(sourceUrl) {
  if (!sourceUrl) throw new Error("uploadPhotoToEps: no source URL provided");

  const token = await getUserToken();

  // Step 1 — createImageFromUrl. eBay fetches from sourceUrl on its end.
  const createRes = await fetch(
    `${EBAY_MEDIA_BASE_URL}/commerce/media/v1_beta/image/create_image_from_url`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ imageUrl: sourceUrl }),
    }
  );

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(
      `Media API createImageFromUrl failed (${createRes.status}): ${errorText}`
    );
  }

  // Image ID arrives as a URI in the Location header:
  //   https://apim.ebay.com/commerce/media/v1_beta/image/{image_id}
  // We extract the trailing segment.
  const locationHeader =
    createRes.headers.get("Location") || createRes.headers.get("location");
  if (!locationHeader) {
    throw new Error(
      "Media API createImageFromUrl returned no Location header — cannot resolve image_id"
    );
  }
  const imageId = locationHeader.split("/").filter(Boolean).pop();
  if (!imageId) {
    throw new Error(
      `Media API createImageFromUrl Location header malformed: ${locationHeader}`
    );
  }

  // Step 2 — getImage to retrieve the EPS URL we'll send to Inventory API.
  const getRes = await fetch(
    `${EBAY_MEDIA_BASE_URL}/commerce/media/v1_beta/image/${encodeURIComponent(imageId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  if (!getRes.ok) {
    const errorText = await getRes.text();
    throw new Error(
      `Media API getImage failed (${getRes.status}): ${errorText}`
    );
  }

  const data = await getRes.json();
  // Be tolerant of small response-shape variations across API revisions —
  // current docs show `imageUrl` but `image` has appeared in some
  // examples. Prefer imageUrl, fall back to image, throw if neither.
  const epsUrl = data?.imageUrl || data?.image;
  if (!epsUrl) {
    throw new Error(
      `Media API getImage returned no EPS URL — body: ${JSON.stringify(data).slice(0, 200)}`
    );
  }
  return epsUrl;
}

export async function uploadPhotosToEps(sourceUrls) {
  if (!sourceUrls?.length) return [];
  // Parallel uploads stay within the 50-req-per-5-sec rate limit even for
  // 20+ photo listings (each photo is 2 requests: create + get).
  return Promise.all(sourceUrls.map((url) => uploadPhotoToEps(url)));
}
