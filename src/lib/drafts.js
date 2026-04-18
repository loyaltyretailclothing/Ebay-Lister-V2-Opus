import cloudinary from "./cloudinary";

const DRAFTS_FOLDER = "ebay-drafts";

export function newDraftId() {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Upload a JSON payload to Cloudinary as a raw resource.
// public_id becomes `${DRAFTS_FOLDER}/${draftId}`.
export async function saveDraft(draftId, payload) {
  const json = JSON.stringify(payload);
  const buffer = Buffer.from(json, "utf8");

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: DRAFTS_FOLDER,
        public_id: draftId,
        overwrite: true,
        invalidate: true,
        // Store quick-access summary on the resource context so listing is cheap
        context: {
          title: (payload.listing?.title || "Untitled").slice(0, 255),
          condition: payload.listing?.condition || "",
          thumbnailUrl: payload.listingPhotos?.[0]?.secure_url || "",
          updatedAt: new Date().toISOString(),
        },
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

// List all drafts (summary only — from Cloudinary context metadata).
export async function listDrafts() {
  const result = await cloudinary.api.resources({
    resource_type: "raw",
    type: "upload",
    prefix: `${DRAFTS_FOLDER}/`,
    max_results: 500,
    context: true,
  });

  return (result.resources || [])
    .map((r) => {
      const ctx = r.context?.custom || {};
      // Extract the draft id from the public_id (strip folder prefix)
      const id = r.public_id.startsWith(`${DRAFTS_FOLDER}/`)
        ? r.public_id.slice(DRAFTS_FOLDER.length + 1)
        : r.public_id;
      return {
        id,
        title: ctx.title || "Untitled",
        condition: ctx.condition || "",
        thumbnailUrl: ctx.thumbnailUrl || "",
        updatedAt: ctx.updatedAt || r.created_at,
        url: r.secure_url,
      };
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

// Fetch a single draft's full payload (downloads the JSON blob).
export async function getDraft(draftId) {
  const publicId = `${DRAFTS_FOLDER}/${draftId}`;
  // Look up the resource to get its secure_url
  let resource;
  try {
    resource = await cloudinary.api.resource(publicId, {
      resource_type: "raw",
    });
  } catch (err) {
    if (err?.error?.http_code === 404 || err?.http_code === 404) {
      return null;
    }
    throw err;
  }

  const res = await fetch(resource.secure_url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch draft JSON: ${res.status}`);
  }
  return res.json();
}

export async function deleteDraft(draftId) {
  const publicId = `${DRAFTS_FOLDER}/${draftId}`;
  return cloudinary.uploader.destroy(publicId, {
    resource_type: "raw",
    invalidate: true,
  });
}
