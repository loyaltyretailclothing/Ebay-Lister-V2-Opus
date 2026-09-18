import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

// Stored photos: shrink to fit inside 1600×1600 (keeping their shape) at
// quality 80. Size/quality go ONLY into the transformation — passed at the
// top level too, Cloudinary adds a second step that forces an exact square.
export async function uploadPhoto(fileBuffer, options = {}) {
  const { width, height, quality, ...rest } = options;
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        ...rest,
        folder: rest.folder || "ebay-listings",
        transformation: [
          {
            width: width || 1600,
            height: height || 1600,
            crop: "limit",
            quality: quality || 80,
          },
        ],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}

export async function deletePhotos(publicIds) {
  // Cloudinary limits to 100 per request — batch if needed
  const results = [];
  for (let i = 0; i < publicIds.length; i += 100) {
    const batch = publicIds.slice(i, i + 100);
    const result = await cloudinary.api.delete_resources(batch);
    results.push(result);
  }
  return results.length === 1 ? results[0] : results;
}

