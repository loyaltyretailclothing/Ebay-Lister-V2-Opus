import { getUserToken } from "@/lib/ebay";
import { EBAY_BASE_URL } from "@/lib/constants";
import { NextResponse } from "next/server";

// GET /api/ebay/locations — read-only.
//
// Every inventory location on the account, with the address each one holds.
// A listing's "Item location" and the origin zip for calculated shipping
// come from the location its offer points at (`merchantLocationKey`) — NOT
// from the shipping business policy, which is a common mix-up. Use this to
// see what buyers are actually being shown. See [[Publishing to eBay]].
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = await getUserToken();
    const res = await fetch(`${EBAY_BASE_URL}/sell/inventory/v1/location?limit=100`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `eBay returned ${res.status}: ${text.slice(0, 300)}` },
        { status: 502 }
      );
    }
    const data = JSON.parse(text);
    const locations = (data.locations || []).map((l) => ({
      key: l.merchantLocationKey,
      name: l.name,
      status: l.merchantLocationStatus,
      types: l.locationTypes,
      address: l.location?.address || null,
    }));
    return NextResponse.json({ success: true, total: data.total ?? locations.length, locations });
  } catch (error) {
    console.error("[locations] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
