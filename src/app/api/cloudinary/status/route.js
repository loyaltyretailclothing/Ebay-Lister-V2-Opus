import cloudinary from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await cloudinary.api.ping();
    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
