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
exports.verifyPassword = exports.hashPassword = exports.isHashed = exports.MAX_PASSWORD_LENGTH = exports.MIN_PASSWORD_LENGTH = void 0;
const crypto_1 = __importDefault(require("crypto"));
// Password hashing with Node's built-in scrypt (no extra package). Stored form:
//   scrypt$<N>$<r>$<p>$<salt base64>$<key base64>
// Passwords created before hashing existed are stored as plain text; verifyPassword()
// still accepts those ONCE and tells the caller to upgrade them (see authorizeUser.ts).
const PREFIX = "scrypt";
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
exports.MIN_PASSWORD_LENGTH = 8; // same rule as the frontend signup form
exports.MAX_PASSWORD_LENGTH = 128; // stops absurdly long inputs from tying up the CPU
function derive(password, salt, n, r, p, keyLength) {
    return new Promise((resolve, reject) => {
        crypto_1.default.scrypt(password, salt, keyLength, { N: n, r, p }, (err, key) => {
            if (err)
                reject(err);
            else
                resolve(key);
        });
    });
}
function isHashed(stored) {
    return typeof stored === "string" && stored.startsWith(`${PREFIX}$`);
}
exports.isHashed = isHashed;
function hashPassword(password) {
    return __awaiter(this, void 0, void 0, function* () {
        const salt = crypto_1.default.randomBytes(SALT_LENGTH);
        const key = yield derive(password, salt, N, R, P, KEY_LENGTH);
        return [PREFIX, N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
    });
}
exports.hashPassword = hashPassword;
// Compares two strings without leaking, through timing, how much of them matched.
function safeEqual(a, b) {
    const digestA = crypto_1.default.createHash("sha256").update(a).digest();
    const digestB = crypto_1.default.createHash("sha256").update(b).digest();
    return crypto_1.default.timingSafeEqual(digestA, digestB);
}
function verifyPassword(plain, stored) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof stored !== "string" || stored.length === 0) {
            return { ok: false, needsUpgrade: false };
        }
        if (!isHashed(stored)) {
            // Legacy plain-text password.
            return { ok: safeEqual(plain, stored), needsUpgrade: true };
        }
        const [, n, r, p, saltB64, keyB64] = stored.split("$");
        const salt = Buffer.from(saltB64 !== null && saltB64 !== void 0 ? saltB64 : "", "base64");
        const expected = Buffer.from(keyB64 !== null && keyB64 !== void 0 ? keyB64 : "", "base64");
        if (!salt.length || !expected.length) {
            return { ok: false, needsUpgrade: false };
        }
        try {
            const actual = yield derive(plain, salt, Number(n), Number(r), Number(p), expected.length);
            return { ok: crypto_1.default.timingSafeEqual(actual, expected), needsUpgrade: false };
        }
        catch (_a) {
            return { ok: false, needsUpgrade: false };
        }
    });
}
exports.verifyPassword = verifyPassword;
