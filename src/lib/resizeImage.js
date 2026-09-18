// Resize an image in the browser before uploading (1600px, JPEG 90%).
// Kept high on purpose: Cloudinary does the one real compression (quality 80).
export function resizeImage(file, maxSize = 1600, quality = 0.9) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Only resize if larger than maxSize
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height / width) * maxSize);
          width = maxSize;
        } else {
          width = Math.round((width / height) * maxSize);
          height = maxSize;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          const resized = new File([blob], file.name, { type: "image/jpeg" });
          resolve(resized);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // If resize fails, send the original
      resolve(file);
    };

    img.src = url;
  });
}

// Cloudinary thumbnail URL (square crop).
export function thumbUrl(url, size = 200) {
  if (!url) return "";
  return url.replace("/upload/", `/upload/c_fill,w_${size},h_${size}/`);
}

// "IMG_4813" from a Cloudinary public_id like "ebay-listings/shannon/img_4813_abc".
export function photoName(photo) {
  const id = photo?.public_id || "";
  return id.split("/").pop() || id;
}
