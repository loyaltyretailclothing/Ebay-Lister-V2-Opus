export const DEFAULTS = {
  PROMO_RATE: 5,
  LISTING_TYPE: "FIXED_PRICE",
  QUANTITY: 1,
  BEST_OFFER: false,
  PHOTO_LIBRARY_SIZE: 1600,
  PHOTO_LIBRARY_QUALITY: 75,
  AI_ANALYSIS_SIZE: 800,
  AI_ANALYSIS_QUALITY: 75,
  MAX_AI_PHOTOS: 8,
};

export const EBAY_BASE_URL =
  process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";

export const EBAY_AUTH_URL =
  process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
    : "https://api.ebay.com/identity/v1/oauth2/token";

export const FOLDERS = ["All Photos", "Shannon", "Aaron"];
