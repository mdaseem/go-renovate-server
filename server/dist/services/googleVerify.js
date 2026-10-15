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
exports.verifyGoogleLogin = void 0;
const axios_1 = __importDefault(require("axios"));
let warned = false;
const ISSUERS = ["accounts.google.com", "https://accounts.google.com"];
function verifyGoogleLogin(idToken, email) {
    return __awaiter(this, void 0, void 0, function* () {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
            if (!warned) {
                warned = true;
                console.warn("[auth] GOOGLE_CLIENT_ID is not set on the server, so Google logins are NOT verified: anyone can sign in as any Google user. Set it.");
            }
            return { ok: true };
        }
        if (typeof idToken !== "string" || idToken.length === 0) {
            return { ok: false, status: 401, message: "Google sign-in could not be verified" };
        }
        try {
            const { data } = yield axios_1.default.get("https://oauth2.googleapis.com/tokeninfo", {
                params: { id_token: idToken },
                timeout: 5000,
            });
            const emailMatches = typeof (data === null || data === void 0 ? void 0 : data.email) === "string" &&
                data.email.toLowerCase() === email.toLowerCase();
            const verified = (data === null || data === void 0 ? void 0 : data.email_verified) === true || (data === null || data === void 0 ? void 0 : data.email_verified) === "true";
            if ((data === null || data === void 0 ? void 0 : data.aud) !== clientId || !ISSUERS.includes(data === null || data === void 0 ? void 0 : data.iss) || !emailMatches || !verified) {
                // Which check failed, for the server log only (never sent to the browser).
                console.warn("[auth] Google sign-in rejected:", {
                    audienceMatches: (data === null || data === void 0 ? void 0 : data.aud) === clientId,
                    issuerOk: ISSUERS.includes(data === null || data === void 0 ? void 0 : data.iss),
                    emailMatches,
                    emailVerified: verified,
                });
                return { ok: false, status: 401, message: "Google sign-in could not be verified" };
            }
            return { ok: true };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response && error.response.status < 500) {
                // Google answered and said the token is bad or expired.
                return { ok: false, status: 401, message: "Google sign-in could not be verified" };
            }
            console.error("Google token verification failed:", error);
            return { ok: false, status: 503, message: "Could not verify Google sign-in. Please try again." };
        }
    });
}
exports.verifyGoogleLogin = verifyGoogleLogin;
