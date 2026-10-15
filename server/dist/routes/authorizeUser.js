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
const express_1 = __importDefault(require("express"));
const userModels_1 = require("../models/userModels");
const authMiddleware_1 = require("../middleware/authMiddleware");
const requireRole_1 = require("../middleware/requireRole");
const passwords_1 = require("../services/passwords");
const authTokens_1 = require("../services/authTokens");
const googleVerify_1 = require("../services/googleVerify");
const loginLimiter_1 = require("../services/loginLimiter");
const router = express_1.default.Router();
const MAX_FIELD_LENGTH = 1024;
function asText(value) {
    return typeof value === "string" && value.length <= MAX_FIELD_LENGTH
        ? value.trim()
        : "";
}
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const data = (_a = req.body) !== null && _a !== void 0 ? _a : {};
        const isGoogle = Boolean(data.isGoogleLogin);
        let userFound;
        if (isGoogle) {
            const email = asText(data.userEmail);
            if (!email) {
                return res.json({ message: "userEmail is required", status: false });
            }
            // Google logins carry no password, so prove the sign-in really happened for this email.
            const verdict = yield (0, googleVerify_1.verifyGoogleLogin)(data.googleIdToken, email);
            if (!verdict.ok) {
                return res
                    .status(verdict.status)
                    .json({ message: verdict.message, status: false });
            }
            userFound = yield userModels_1.Users.findOne({ userEmail: email });
            // Provision a Users document on first Google sign-in, since no other path creates one.
            if (!userFound) {
                userFound = yield userModels_1.Users.create({
                    userEmail: email,
                    userName: asText(data.userName) || email,
                    userId: Date.now(),
                    connections: [],
                });
            }
        }
        else {
            const email = asText(data.email);
            const password = typeof data.password === "string" && data.password.length <= MAX_FIELD_LENGTH
                ? data.password
                : "";
            if (!email || !password) {
                return res.json({ message: "Email and password are required", status: false });
            }
            const key = (0, loginLimiter_1.limiterKey)(req, email);
            if ((0, loginLimiter_1.isLoginBlocked)(key)) {
                return res.status(429).json({
                    message: "Too many attempts. Please wait a few minutes and try again.",
                    status: false,
                });
            }
            // Several documents can share an email (for example a Google user and a password user),
            // so check each one's password instead of taking the first match.
            const candidates = yield userModels_1.Users.find({
                userEmail: { $in: [email, email.toLowerCase()] },
            });
            for (const candidate of candidates) {
                const check = yield (0, passwords_1.verifyPassword)(password, candidate.get("userPassword"));
                if (!check.ok)
                    continue;
                userFound = candidate;
                if (check.needsUpgrade) {
                    // First login since passwords were hashed: replace the plain text with a hash.
                    try {
                        yield userModels_1.Users.updateOne({ _id: candidate._id }, { $set: { userPassword: yield (0, passwords_1.hashPassword)(password) } });
                    }
                    catch (error) {
                        console.error("Failed to upgrade a stored password:", error);
                    }
                }
                break;
            }
            if (!userFound) {
                (0, loginLimiter_1.recordLoginFailure)(key);
                return res.json({ message: "Invalid password", status: false });
            }
            (0, loginLimiter_1.clearLoginFailures)(key);
        }
        const token = (0, authTokens_1.signUserToken)({
            userId: (_b = userFound.userId) !== null && _b !== void 0 ? _b : undefined,
            userEmail: (_c = userFound.userEmail) !== null && _c !== void 0 ? _c : undefined,
            userName: (_d = userFound.userName) !== null && _d !== void 0 ? _d : undefined,
        });
        return res.json({
            token,
            status: true,
            user: {
                name: userFound.userName,
                email: userFound.userEmail,
                id: userFound.userId,
                connections: userFound.connections,
            },
        });
    }
    catch (error) {
        console.error("Login failed:", error);
        return res.status(500).json({ message: "Login failed", status: false });
    }
}));
// GET /auth/me - who am I and what may I do, read fresh from the database (not from the token),
// so a role change shows up without logging in again. The frontend's vendor pages use this.
router.get("/me", authMiddleware_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const current = yield (0, requireRole_1.loadCurrentUser)(req);
        if (!current) {
            return res.status(401).json({ message: "Invalid session" });
        }
        return res.json({
            id: current.userId,
            email: current.userEmail,
            name: current.userName,
            role: current.role,
            vendorId: current.vendorId,
        });
    }
    catch (error) {
        console.error("Failed to load the current user:", error);
        return res.status(500).json({ message: "Could not load your account" });
    }
}));
exports.default = router;
