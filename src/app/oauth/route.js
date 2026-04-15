import { NextResponse } from "next/server";

// eBay redirects to /oauth (as configured in RuName settings)
// Forward to our actual callback handler
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const params = searchParams.toString();
  const callbackUrl = new URL(`/api/ebay/callback?${params}`, request.url);
  return NextResponse.redirect(callbackUrl.toString());
}
