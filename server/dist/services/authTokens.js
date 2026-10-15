"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signUserToken = exports.getJwtSecret = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const LEGACY_SECRET = "any_random_string_generated_once";
const MIN_SECRET_LENGTH = 32;
let warned = false;
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (secret && secret.length >= MIN_SECRET_LENGTH)
        return secret;
    if (!warned) {
        warned = true;
        console.warn(`[auth] JWT_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters, so the OLD built-in secret is being used. ` +
            "Anyone who has seen the source code can forge login tokens. Set JWT_SECRET on the server.");
    }
    return LEGACY_SECRET;
}
exports.getJwtSecret = getJwtSecret;
function signUserToken(user) {
    const payload = {
        name: {
            userId: user.userId,
            userEmail: user.userEmail,
            userName: user.userName,
        },
    };
    return jsonwebtoken_1.default.sign(payload, getJwtSecret(), { expiresIn: "2 days" });
}
exports.signUserToken = signUserToken;
