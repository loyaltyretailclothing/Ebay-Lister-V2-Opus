import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

export async function uploadPhoto(fileBuffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || "ebay-listings",
        transformation: [
          {
            width: options.width || 1600,
            height: options.height || 1600,
            crop: "limit",
            quality: options.quality || 75,
          },
        ],
        ...options,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}

export async function listPhotos(folder = "ebay-listings") {
  const result = await cloudinary.api.resources({
    type: "upload",
    prefix: folder,
    max_results: 500,
    context: true,
    metadata: true,
  });
  return result.resources;
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

