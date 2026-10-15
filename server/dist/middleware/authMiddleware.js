"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authTokens_1 = require("../services/authTokens");
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader === null || authHeader === void 0 ? void 0 : authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, (0, authTokens_1.getJwtSecret)());
        req.user = decoded; // { name: { userId, userEmail, userName } }
        next();
    }
    catch (err) {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}
exports.requireAuth = requireAuth;
