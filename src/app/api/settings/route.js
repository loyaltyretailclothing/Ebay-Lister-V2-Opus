import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CONFIG_PUBLIC_ID = "ebay-listings/config/item-specifics";

// Load current config from Cloudinary
async function loadConfig() {
  const url = cloudinary.url(CONFIG_PUBLIC_ID, {
    resource_type: "raw",
    secure: true,
    version: Date.now(),
  });
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  // Backward compat: old format stored categories directly (no wrapper)
  if (data && !data.categories && !data.policies) {
    return { categories: data, policies: {} };
  }
  return data;
}

// Save config to Cloudinary
async function saveConfig(config) {
  const jsonStr = JSON.stringify(config, null, 2);
  const dataUri = `data:application/json;base64,${Buffer.from(jsonStr).toString("base64")}`;
  await cloudinary.uploader.upload(dataUri, {
    public_id: CONFIG_PUBLIC_ID,
    resource_type: "raw",
    overwrite: true,
    invalidate: true,
  });
}

// GET — retrieve saved config
export async function GET() {
  try {
    const config = await loadConfig();
    return NextResponse.json({
      success: true,
      categories: config?.categories || {},
      policies: config?.policies || {},
    });
  } catch (error) {
    console.error("Settings load error:", error);
    return NextResponse.json({ success: true, categories: {}, policies: {} });
  }
}

// POST — save config (accepts categories, policies, or both)
export async function POST(request) {
  try {
    const body = await request.json();
    const existing = (await loadConfig()) || { categories: {}, policies: {} };

    const updated = {
      categories:
        body.categories !== undefined ? body.categories : existing.categories,
      policies:
        body.policies !== undefined ? body.policies : existing.policies,
    };

    await saveConfig(updated);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings save error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
