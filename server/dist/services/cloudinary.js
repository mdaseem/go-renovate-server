"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUploadedPhoto = exports.publicIdFromUrl = exports.checkUploadedPhoto = exports.isOwnPhotoId = exports.createUploadTicket = exports.vendorFolder = exports.getCloudinaryConfig = exports.PHOTO_LIMITS = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
// Product photos live on Cloudinary. The vendor's phone uploads straight to Cloudinary with a short-lived
// signature from this server (so photos never pass through this server), and the server then asks
// Cloudinary what actually arrived before it saves anything on a product. Nothing a client says about a
// photo (its address, size, type) is trusted: only what Cloudinary reports for a public id inside the
// vendor's own folder.
exports.PHOTO_LIMITS = {
    maxPerProduct: 5,
    maxBytes: 5 * 1024 * 1024,
    minSide: 200,
    maxSide: 8000,
    // The phone shrinks photos before sending; these are what the server will accept in the end.
    allowedFormats: ["jpg", "png", "webp"],
};
const API_TIMEOUT_MS = 10000;
const FOLDER_ROOT = "gorenovate/vendors";
const VENDOR_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
const PHOTO_ID_PATTERN = /^[a-f0-9]{24}$/;
// Read lazily: index.ts calls dotenv.config() after its imports have run. Null = photo upload is off.
function getCloudinaryConfig() {
    var _a, _b, _c;
    const cloudName = (_a = process.env.CLOUDINARY_CLOUD_NAME) === null || _a === void 0 ? void 0 : _a.trim();
    const apiKey = (_b = process.env.CLOUDINARY_API_KEY) === null || _b === void 0 ? void 0 : _b.trim();
    const apiSecret = (_c = process.env.CLOUDINARY_API_SECRET) === null || _c === void 0 ? void 0 : _c.trim();
    if (!cloudName || !apiKey || !apiSecret)
        return null;
    if (!/^[A-Za-z0-9_-]+$/.test(cloudName))
        return null;
    return { cloudName, apiKey, apiSecret };
}
exports.getCloudinaryConfig = getCloudinaryConfig;
// The folder every photo of one vendor lives in. Null when the vendor id is not a safe path segment.
function vendorFolder(vendorId) {
    return VENDOR_SEGMENT.test(vendorId) ? `${FOLDER_ROOT}/${vendorId}` : null;
}
exports.vendorFolder = vendorFolder;
// Cloudinary's signature: SHA-1 of the sorted "key=value" pairs joined with "&", followed by the API secret.
function sign(params, apiSecret) {
    const text = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&");
    return crypto_1.default.createHash("sha1").update(text + apiSecret).digest("hex");
}
// Everything the browser needs to upload one photo into the vendor's own folder under a fresh random name.
// The public id is part of the signature, so it cannot be changed; `overwrite=false` stops it replacing a photo.
function createUploadTicket(config, vendorId) {
    const folder = vendorFolder(vendorId);
    if (!folder)
        return null;
    const publicId = `${folder}/${crypto_1.default.randomBytes(12).toString("hex")}`;
    const signed = {
        allowed_formats: exports.PHOTO_LIMITS.allowedFormats.join(","),
        overwrite: "false",
        public_id: publicId,
        timestamp: String(Math.floor(Date.now() / 1000)),
    };
    return {
        uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
        fields: Object.assign(Object.assign({}, signed), { api_key: config.apiKey, signature: sign(signed, config.apiSecret) }),
        publicId,
    };
}
exports.createUploadTicket = createUploadTicket;
// A public id this vendor is allowed to attach: exactly <their folder>/<24 hex characters>.
function isOwnPhotoId(vendorId, publicId) {
    const folder = vendorFolder(vendorId);
    if (!folder || typeof publicId !== "string" || !publicId.startsWith(`${folder}/`))
        return false;
    return PHOTO_ID_PATTERN.test(publicId.slice(folder.length + 1));
}
exports.isOwnPhotoId = isOwnPhotoId;
// Asks Cloudinary what is stored under this public id (the caller has already matched it with isOwnPhotoId,
// so it is safe in the request path). Only an image of an allowed format, within the
// size limits, that really sits under our cloud name passes; the address that gets saved is built from
// Cloudinary's answer, never from the request.
function checkUploadedPhoto(config, publicId) {
    return __awaiter(this, void 0, void 0, function* () {
        let data;
        try {
            const response = yield axios_1.default.get(`https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload/${publicId}`, {
                auth: { username: config.apiKey, password: config.apiSecret },
                timeout: API_TIMEOUT_MS,
                validateStatus: (status) => status === 200 || status === 404,
                maxContentLength: 200000,
            });
            if (response.status === 404)
                return { ok: false, reason: "missing" };
            data = response.data;
        }
        catch (error) {
            console.error("Cloudinary photo check failed:", error.message);
            return { ok: false, reason: "unavailable" };
        }
        const format = typeof data.format === "string" ? data.format.toLowerCase() : "";
        if (data.public_id !== publicId || data.resource_type !== "image" || data.type !== "upload") {
            return { ok: false, reason: "missing" };
        }
        if (!exports.PHOTO_LIMITS.allowedFormats.includes(format))
            return { ok: false, reason: "format" };
        const { bytes, width, height, secure_url: secureUrl } = data;
        if (typeof bytes !== "number" || bytes <= 0 || bytes > exports.PHOTO_LIMITS.maxBytes)
            return { ok: false, reason: "size" };
        const side = (value) => typeof value === "number" && value >= exports.PHOTO_LIMITS.minSide && value <= exports.PHOTO_LIMITS.maxSide;
        if (!side(width) || !side(height))
            return { ok: false, reason: "dimensions" };
        const prefix = `https://res.cloudinary.com/${config.cloudName}/image/upload/`;
        if (typeof secureUrl !== "string" || !secureUrl.startsWith(prefix) || !secureUrl.includes(publicId)) {
            return { ok: false, reason: "unavailable" };
        }
        return { ok: true, url: secureUrl };
    });
}
exports.checkUploadedPhoto = checkUploadedPhoto;
// The public id inside a photo address we saved earlier, or null if the address is not one of ours.
function publicIdFromUrl(config, url) {
    // The cloud name is letters, digits, "-" and "_" only (getCloudinaryConfig), so it is safe inside a pattern.
    const match = new RegExp(`^https://res\\.cloudinary\\.com/${config.cloudName}/image/upload/(?:v\\d+/)?(${FOLDER_ROOT}/[A-Za-z0-9_-]{1,64}/[a-f0-9]{24})\\.(?:jpg|png|webp)$`).exec(url);
    return match ? match[1] : null;
}
exports.publicIdFromUrl = publicIdFromUrl;
// Removes a photo from Cloudinary. Best effort: a failure only leaves an unused file behind, so it is
// logged and never stops the vendor's action.
function deleteUploadedPhoto(config, publicId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const signed = { invalidate: "true", public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)) };
            const body = new URLSearchParams(Object.assign(Object.assign({}, signed), { api_key: config.apiKey, signature: sign(signed, config.apiSecret) }));
            yield axios_1.default.post(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, body.toString(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                timeout: API_TIMEOUT_MS,
            });
            return true;
        }
        catch (error) {
            console.error("Cloudinary photo delete failed:", error.message);
            return false;
        }
    });
}
exports.deleteUploadedPhoto = deleteUploadedPhoto;
