import { EBAY_AUTH_URL } from "@/lib/constants";
import { NextResponse } from "next/server";

// Exchange authorization code for user token + refresh token
export async function POST(request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { success: false, error: "No authorization code provided" },
        { status: 400 }
      );
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
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.EBAY_RUNAME,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            data.error_description || data.error || "Token exchange failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      refresh_token: data.refresh_token,
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_token_expires_in: data.refresh_token_expires_in,
    });
  } catch (error) {
    console.error("OAuth exchange error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
