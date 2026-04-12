import { getAccessToken } from "@/lib/ebay";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const refreshToken = process.env.EBAY_OAUTH_REFRESH_TOKEN || "";
    const clientId = process.env.EBAY_CLIENT_ID || "";
    const token = await getAccessToken();
    return NextResponse.json({
      success: true,
      hasToken: !!token,
      debug: {
        clientIdPrefix: clientId.substring(0, 10),
        refreshTokenPrefix: refreshToken.substring(0, 20),
        refreshTokenLength: refreshToken.length,
      },
    });
  } catch (error) {
    const refreshToken = process.env.EBAY_OAUTH_REFRESH_TOKEN || "";
    const clientId = process.env.EBAY_CLIENT_ID || "";
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        debug: {
          clientIdPrefix: clientId.substring(0, 10),
          refreshTokenPrefix: refreshToken.substring(0, 20),
          refreshTokenLength: refreshToken.length,
        },
      },
      { status: 500 }
    );
  }
}
