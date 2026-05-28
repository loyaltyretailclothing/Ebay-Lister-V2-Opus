export const DEFAULTS = {
  PROMO_RATE: 5,
  LISTING_TYPE: "FIXED_PRICE",
  QUANTITY: 1,
};

export const EBAY_BASE_URL =
  process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";

// Media API uses a different host (apim.ebay.com) from the Sell/Commerce
// APIs. Used for uploading photos to EPS so we hand eBay back its own
// URLs in the Inventory API call.
export const EBAY_MEDIA_BASE_URL =
  process.env.EBAY_SANDBOX === "true"
    ? "https://apim.sandbox.ebay.com"
    : "https://apim.ebay.com";

export const EBAY_AUTH_URL =
  process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
    : "https://api.ebay.com/identity/v1/oauth2/token";

export const FOLDERS = ["All Photos", "Shannon", "Aaron"];
