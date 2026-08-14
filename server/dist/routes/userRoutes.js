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
const chatUserModel_1 = require("../models/chatUserModel");
const router = express_1.default.Router();
const MAX_RECENT_SEARCHES = 10;
const MAX_TERM_LENGTH = 100;
// requireAuth sets req.user = decoded, and the token is signed as
// { name: userFound } (see authorizeUser.ts / orderRoutes.ts), so the
// actual user fields live one level down at req.user.name.
function getAuthedUserId(req) {
    var _a;
    const decoded = req.user;
    return (_a = decoded === null || decoded === void 0 ? void 0 : decoded.name) === null || _a === void 0 ? void 0 : _a.userId;
}
// requireAuth only verifies the JWT signature — it doesn't guarantee the
// decoded payload actually has the shape these routes expect. Without this,
// a malformed/foreign-shaped token would fall through to
// Users.findOne({ userId: undefined }), which is an ambiguous query rather
// than a clean failure.
function requireAuthedUserId(req, res) {
    const userId = getAuthedUserId(req);
    if (typeof userId !== "number") {
        res.status(401).json({ message: "Invalid session" });
        return undefined;
    }
    return userId;
}
router.get("/userData/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const user = yield userModels_1.Users.findOne({ _id: id });
    res.json(user);
}));
router.get("/userlist", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const users = yield chatUserModel_1.ChatUsers.find({});
    res.json(users);
}));
router.get("/recent-searches", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = requireAuthedUserId(req, res);
        if (userId === undefined)
            return;
        const user = yield userModels_1.Users.findOne({ userId });
        const terms = ((user === null || user === void 0 ? void 0 : user.recentSearches) || []).map((entry) => entry.term);
        return res.json(terms);
    }
    catch (error) {
        console.error("Failed to fetch recent searches:", error);
        return res.status(500).json({ message: "Failed to fetch recent searches" });
    }
}));
router.post("/recent-searches", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = requireAuthedUserId(req, res);
        if (userId === undefined)
            return;
        const term = (typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.term) === "string" ? req.body.term.trim() : "").slice(0, MAX_TERM_LENGTH);
        if (!term) {
            return res.status(400).json({ message: "term is required" });
        }
        const user = yield userModels_1.Users.findOne({ userId });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const existing = (user.recentSearches || [])
            .filter((entry) => entry.term.toLowerCase() !== term.toLowerCase())
            .map((entry) => ({ term: entry.term, searchedAt: entry.searchedAt }));
        const updated = [{ term, searchedAt: new Date() }, ...existing].slice(0, MAX_RECENT_SEARCHES);
        user.recentSearches = updated;
        yield user.save();
        return res.json(updated.map((entry) => entry.term));
    }
    catch (error) {
        console.error("Failed to save recent search:", error);
        return res.status(500).json({ message: "Failed to save recent search" });
    }
}));
router.delete("/recent-searches/:term", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = requireAuthedUserId(req, res);
        if (userId === undefined)
            return;
        const term = req.params.term;
        const user = yield userModels_1.Users.findOne({ userId });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const updated = (user.recentSearches || [])
            .filter((entry) => entry.term.toLowerCase() !== term.toLowerCase())
            .map((entry) => ({ term: entry.term, searchedAt: entry.searchedAt }));
        user.recentSearches = updated;
        yield user.save();
        return res.json(updated.map((entry) => entry.term));
    }
    catch (error) {
        console.error("Failed to remove recent search:", error);
        return res.status(500).json({ message: "Failed to remove recent search" });
    }
}));
router.delete("/recent-searches", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = requireAuthedUserId(req, res);
        if (userId === undefined)
            return;
        const user = yield userModels_1.Users.findOne({ userId });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        user.recentSearches = [];
        yield user.save();
        return res.json([]);
    }
    catch (error) {
        console.error("Failed to clear recent searches:", error);
        return res.status(500).json({ message: "Failed to clear recent searches" });
    }
}));
exports.default = router;
