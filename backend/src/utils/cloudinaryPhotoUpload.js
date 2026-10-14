import multer from "multer";
import crypto from "crypto";

// Shared by every self-/admin-managed photo upload route (see
// studentRoute.js for the original inline version this was extracted from,
// and teacherPortalRoute.js for the self-service teacher use). Accepts
// either a multipart file (Cloudinary, when configured) or a base64 data
// URL fallback so local dev works with zero Cloudinary setup.
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "institute_portal";
export const isCloudinaryConfigured = !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image uploads are allowed"));
    cb(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

export async function uploadToCloudinary(file) {
  if (!isCloudinaryConfigured) throw new Error("Cloudinary configuration is missing");

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash("sha1")
    .update(`timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
    .digest("hex");

  const formData = new FormData();
  formData.append("file", `data:${file.mimetype};base64,${file.buffer.toString("base64")}`);
  formData.append("api_key", CLOUDINARY_API_KEY);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signature);
  formData.append("folder", CLOUDINARY_FOLDER);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Cloudinary upload failed");
  return data.secure_url || data.url;
}

// Handles both request shapes (multipart file vs JSON base64 body) and
// returns the final photo value to store, or throws a user-facing Error.
export async function resolveUploadedPhoto(req) {
  if (req.file) {
    if (!req.file.mimetype.startsWith("image/")) throw new Error("Only image uploads are allowed");
    return isCloudinaryConfigured
      ? uploadToCloudinary(req.file)
      : `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  }
  const { photo } = req.body;
  if (!photo) throw new Error("photo field is required");
  if (!photo.startsWith("data:image/")) throw new Error("photo must be a base64 image data URL");
  if (photo.length > 2_800_000) throw new Error("Photo too large. Max ~2 MB.");
  return photo;
}
