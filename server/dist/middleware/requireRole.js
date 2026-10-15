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
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.loadCurrentUser = void 0;
const userModels_1 = require("../models/userModels");
const roles_1 = require("../services/roles");
// Loads the signed-in user from the database using the id inside the token (requireAuth must
// have run first). The role always comes from the database / ADMIN_EMAILS, never from the
// token, so a role change takes effect on the next request without logging in again.
function loadCurrentUser(req) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        const tokenUser = (_a = req.user) === null || _a === void 0 ? void 0 : _a.name;
        const userId = tokenUser === null || tokenUser === void 0 ? void 0 : tokenUser.userId;
        if (typeof userId !== "number")
            return null;
        // Look up by email, then confirm the id. Some older accounts store their numeric userId as text in
        // the database, which a query on userId alone would not match (the token's id is already a number).
        const email = tokenUser === null || tokenUser === void 0 ? void 0 : tokenUser.userEmail;
        const candidates = typeof email === "string" ? yield userModels_1.Users.find({ userEmail: email }) : yield userModels_1.Users.find({ userId });
        const user = candidates.find((candidate) => Number(candidate.userId) === userId);
        if (!user)
            return null;
        return {
            userId,
            userEmail: (_b = user.userEmail) !== null && _b !== void 0 ? _b : undefined,
            userName: (_c = user.userName) !== null && _c !== void 0 ? _c : undefined,
            role: (0, roles_1.resolveRole)(user),
            vendorId: (_d = user.get("vendorId")) !== null && _d !== void 0 ? _d : null,
        };
    });
}
exports.loadCurrentUser = loadCurrentUser;
// Use after requireAuth:  router.use(requireAuth, requireRole("admin"))
// Sets req.currentUser for the handlers that follow.
function requireRole(...allowed) {
    return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        try {
            const current = yield loadCurrentUser(req);
            if (!current) {
                return res.status(401).json({ message: "Invalid session" });
            }
            if (!allowed.includes(current.role)) {
                return res.status(403).json({ message: "You do not have access to this" });
            }
            req.currentUser = current;
            next();
        }
        catch (error) {
            console.error("Role check failed:", error);
            res.status(500).json({ message: "Could not check your access. Please try again." });
        }
    });
}
exports.requireRole = requireRole;
