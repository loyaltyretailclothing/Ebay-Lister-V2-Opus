import { NextResponse } from "next/server";

// Step 2: eBay redirects here with an auth code — exchange it for tokens
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    const error = searchParams.get("error_description") || searchParams.get("error") || "No authorization code received";
    return NextResponse.redirect(
      new URL(`/settings/ebay?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const ruName = process.env.EBAY_RUNAME;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: ruName,
      }),
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok || !data.refresh_token) {
      const error = data.error_description || data.error || "Token exchange failed";
      return NextResponse.redirect(
        new URL(`/settings/ebay?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Store the refresh token in Cloudinary metadata (alongside settings)
    // For now, display it so the user can add it to env vars
    const refreshToken = data.refresh_token;
    const expiresIn = data.refresh_token_expires_in; // seconds
    const expiresDate = new Date(Date.now() + expiresIn * 1000).toLocaleDateString();

    return NextResponse.redirect(
      new URL(
        `/settings/ebay?success=true&token=${encodeURIComponent(refreshToken)}&expires=${encodeURIComponent(expiresDate)}`,
        request.url
      )
    );
  } catch (error) {
    return NextResponse.redirect(
      new URL(`/settings/ebay?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
