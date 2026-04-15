import { NextResponse } from "next/server";

// Step 1: Redirect user to eBay's OAuth consent page
export async function GET() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const ruName = process.env.EBAY_RUNAME;

  if (!clientId || !ruName) {
    return NextResponse.json(
      { error: "EBAY_CLIENT_ID or EBAY_RUNAME not configured" },
      { status: 500 }
    );
  }

  const scopes = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.marketing",
    "https://api.ebay.com/oauth/api_scope/sell.account",
    "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  ].join(" ");

  const authUrl = new URL("https://auth.ebay.com/oauth2/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", ruName);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);

  return NextResponse.redirect(authUrl.toString());
}
