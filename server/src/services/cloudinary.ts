import axios from "axios";
import crypto from "crypto";

// Product photos live on Cloudinary. The vendor's phone uploads straight to Cloudinary with a short-lived
// signature from this server (so photos never pass through this server), and the server then asks
// Cloudinary what actually arrived before it saves anything on a product. Nothing a client says about a
// photo (its address, size, type) is trusted: only what Cloudinary reports for a public id inside the
// vendor's own folder.

export const PHOTO_LIMITS = {
  maxPerProduct: 5,
  maxBytes: 5 * 1024 * 1024,
  minSide: 200,
  maxSide: 8000,
  // The phone shrinks photos before sending; these are what the server will accept in the end.
  allowedFormats: ["jpg", "png", "webp"],
} as const;

const API_TIMEOUT_MS = 10_000;
const FOLDER_ROOT = "gorenovate/vendors";
const VENDOR_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
const PHOTO_ID_PATTERN = /^[a-f0-9]{24}$/;

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

// Read lazily: index.ts calls dotenv.config() after its imports have run. Null = photo upload is off.
export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName)) return null;
  return { cloudName, apiKey, apiSecret };
}

// The folder every photo of one vendor lives in. Null when the vendor id is not a safe path segment.
export function vendorFolder(vendorId: string): string | null {
  return VENDOR_SEGMENT.test(vendorId) ? `${FOLDER_ROOT}/${vendorId}` : null;
}

// Cloudinary's signature: SHA-1 of the sorted "key=value" pairs joined with "&", followed by the API secret.
function sign(params: Record<string, string>, apiSecret: string): string {
  const text = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(text + apiSecret).digest("hex");
}

export interface UploadTicket {
  uploadUrl: string;
  fields: Record<string, string>;
  publicId: string;
}

// Everything the browser needs to upload one photo into the vendor's own folder under a fresh random name.
// The public id is part of the signature, so it cannot be changed; `overwrite=false` stops it replacing a photo.
export function createUploadTicket(config: CloudinaryConfig, vendorId: string): UploadTicket | null {
  const folder = vendorFolder(vendorId);
  if (!folder) return null;
  const publicId = `${folder}/${crypto.randomBytes(12).toString("hex")}`;
  const signed: Record<string, string> = {
    allowed_formats: PHOTO_LIMITS.allowedFormats.join(","),
    overwrite: "false",
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    fields: { ...signed, api_key: config.apiKey, signature: sign(signed, config.apiSecret) },
    publicId,
  };
}

// A public id this vendor is allowed to attach: exactly <their folder>/<24 hex characters>.
export function isOwnPhotoId(vendorId: string, publicId: unknown): publicId is string {
  const folder = vendorFolder(vendorId);
  if (!folder || typeof publicId !== "string" || !publicId.startsWith(`${folder}/`)) return false;
  return PHOTO_ID_PATTERN.test(publicId.slice(folder.length + 1));
}

export type PhotoCheck =
  | { ok: true; url: string }
  | { ok: false; reason: "missing" | "format" | "size" | "dimensions" | "unavailable" };

// Asks Cloudinary what is stored under this public id (the caller has already matched it with isOwnPhotoId,
// so it is safe in the request path). Only an image of an allowed format, within the
// size limits, that really sits under our cloud name passes; the address that gets saved is built from
// Cloudinary's answer, never from the request.
export async function checkUploadedPhoto(config: CloudinaryConfig, publicId: string): Promise<PhotoCheck> {
  let data: Record<string, unknown>;
  try {
    const response = await axios.get(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload/${publicId}`,
      {
        auth: { username: config.apiKey, password: config.apiSecret },
        timeout: API_TIMEOUT_MS,
        validateStatus: (status) => status === 200 || status === 404,
        maxContentLength: 200_000,
      },
    );
    if (response.status === 404) return { ok: false, reason: "missing" };
    data = response.data as Record<string, unknown>;
  } catch (error) {
    console.error("Cloudinary photo check failed:", (error as Error).message);
    return { ok: false, reason: "unavailable" };
  }

  const format = typeof data.format === "string" ? data.format.toLowerCase() : "";
  if (data.public_id !== publicId || data.resource_type !== "image" || data.type !== "upload") {
    return { ok: false, reason: "missing" };
  }
  if (!(PHOTO_LIMITS.allowedFormats as readonly string[]).includes(format)) return { ok: false, reason: "format" };
  const { bytes, width, height, secure_url: secureUrl } = data;
  if (typeof bytes !== "number" || bytes <= 0 || bytes > PHOTO_LIMITS.maxBytes) return { ok: false, reason: "size" };
  const side = (value: unknown) => typeof value === "number" && value >= PHOTO_LIMITS.minSide && value <= PHOTO_LIMITS.maxSide;
  if (!side(width) || !side(height)) return { ok: false, reason: "dimensions" };
  const prefix = `https://res.cloudinary.com/${config.cloudName}/image/upload/`;
  if (typeof secureUrl !== "string" || !secureUrl.startsWith(prefix) || !secureUrl.includes(publicId)) {
    return { ok: false, reason: "unavailable" };
  }
  return { ok: true, url: secureUrl };
}

// The public id inside a photo address we saved earlier, or null if the address is not one of ours.
export function publicIdFromUrl(config: CloudinaryConfig, url: string): string | null {
  // The cloud name is letters, digits, "-" and "_" only (getCloudinaryConfig), so it is safe inside a pattern.
  const match = new RegExp(
    `^https://res\\.cloudinary\\.com/${config.cloudName}/image/upload/(?:v\\d+/)?(${FOLDER_ROOT}/[A-Za-z0-9_-]{1,64}/[a-f0-9]{24})\\.(?:jpg|png|webp)$`,
  ).exec(url);
  return match ? match[1] : null;
}

// Removes a photo from Cloudinary. Best effort: a failure only leaves an unused file behind, so it is
// logged and never stops the vendor's action.
export async function deleteUploadedPhoto(config: CloudinaryConfig, publicId: string): Promise<boolean> {
  try {
    const signed = { invalidate: "true", public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)) };
    const body = new URLSearchParams({ ...signed, api_key: config.apiKey, signature: sign(signed, config.apiSecret) });
    await axios.post(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, body.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: API_TIMEOUT_MS,
    });
    return true;
  } catch (error) {
    console.error("Cloudinary photo delete failed:", (error as Error).message);
    return false;
  }
}
