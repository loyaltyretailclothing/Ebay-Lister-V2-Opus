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

// POST — change the saved config. Category changes are made ONE category at
// a time against the stored file, so a change can never wipe out the other
// saved categories (a whole-list save from a page that hadn't finished
// loading used to replace every category with just one):
//   { addCategory: { id, config } }  add it only if it isn't saved yet
//   { setCategory: { id, config } }  replace that one category
//   { removeCategory: id }           remove that one category
//   { policies }                     replace the policies
export async function POST(request) {
  try {
    const body = await request.json();
    if (body.categories !== undefined) {
      return NextResponse.json(
        { success: false, error: "Whole-list category saves are no longer accepted" },
        { status: 400 }
      );
    }

    const existing = (await loadConfig()) || { categories: {}, policies: {} };
    const categories = { ...(existing.categories || {}) };
    let changed = false;

    if (body.addCategory?.id && !categories[body.addCategory.id]) {
      categories[body.addCategory.id] = body.addCategory.config;
      changed = true;
    }
    if (body.setCategory?.id) {
      categories[body.setCategory.id] = body.setCategory.config;
      changed = true;
    }
    if (body.removeCategory && categories[body.removeCategory]) {
      delete categories[body.removeCategory];
      changed = true;
    }

    const updated = {
      categories,
      policies: body.policies !== undefined ? body.policies : existing.policies || {},
    };
    if (body.policies !== undefined) changed = true;

    if (changed) await saveConfig(updated);
    return NextResponse.json({ success: true, categories: updated.categories });
  } catch (error) {
    console.error("Settings save error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
