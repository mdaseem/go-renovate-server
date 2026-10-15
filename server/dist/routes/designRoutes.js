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
const crypto_1 = __importDefault(require("crypto"));
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const categoryModel_1 = require("../models/categoryModel");
const essentialModel_1 = require("../models/essentialModel");
const designModel_1 = require("../models/designModel");
const router = express_1.default.Router();
const MAX_PIECES = 60;
const OBJECT_ID = /^[0-9a-f]{24}$/;
const PIECE_KEY = /^[0-9a-f]{24}#\d{1,3}$/;
// A piece resting on another piece ("<id>#<copy>") or on a part of the room ("space:counter-0").
const SUPPORT_KEY = /^([0-9a-f]{24}#\d{1,3}|space:[a-z0-9:-]{1,40})$/;
const SLUG = /^[a-z0-9-]{1,64}$/;
const TOKEN = /^[a-z0-9-]{1,32}$/;
const SHORT_ID = /^[A-Za-z0-9]{10}$/;
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// Anyone can save, so the endpoint is rate limited per IP (in memory - fine for
// one server instance; move to a shared store if the API is ever scaled out).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_SAVES_PER_WINDOW = 12;
const saves = new Map();
function isRateLimited(ip) {
    var _a;
    const now = Date.now();
    const recent = ((_a = saves.get(ip)) !== null && _a !== void 0 ? _a : []).filter((time) => now - time < WINDOW_MS);
    if (recent.length >= MAX_SAVES_PER_WINDOW) {
        saves.set(ip, recent);
        return true;
    }
    recent.push(now);
    saves.set(ip, recent);
    // Keep the map from growing forever.
    if (saves.size > 5000) {
        for (const [key, times] of saves) {
            if (times.every((time) => now - time >= WINDOW_MS))
                saves.delete(key);
        }
    }
    return false;
}
function makeShortId() {
    const bytes = crypto_1.default.randomBytes(10);
    return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}
const isFiniteNumber = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
// Returns a cleaned transform or null when anything is out of range - the
// client is untrusted, and these values end up drawn on other people's screens.
function cleanPosition(raw) {
    if (typeof raw !== "object" || raw === null)
        return null;
    const input = raw;
    if (!isFiniteNumber(input.x, -50, 150) || !isFiniteNumber(input.y, -50, 150))
        return null;
    const out = { x: input.x, y: input.y };
    if (input.scale !== undefined) {
        if (!isFiniteNumber(input.scale, 0.5, 2))
            return null;
        out.scale = input.scale;
    }
    if (input.flipped !== undefined) {
        if (typeof input.flipped !== "boolean")
            return null;
        out.flipped = input.flipped;
    }
    if (input.front !== undefined) {
        if (typeof input.front !== "boolean")
            return null;
        out.front = input.front;
    }
    if (input.onKey !== undefined) {
        if (typeof input.onKey !== "string" || !SUPPORT_KEY.test(input.onKey))
            return null;
        out.onKey = input.onKey;
    }
    if (input.dx !== undefined) {
        if (!isFiniteNumber(input.dx, -100, 100))
            return null;
        out.dx = input.dx;
    }
    return out;
}
// undefined = invalid, null = not provided.
function optionalNumber(value, min, max) {
    if (value === undefined || value === null)
        return null;
    return isFiniteNumber(value, min, max) ? value : undefined;
}
function optionalToken(value) {
    if (value === undefined || value === null)
        return null;
    return typeof value === "string" && TOKEN.test(value) ? value : undefined;
}
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (isRateLimited((_a = req.ip) !== null && _a !== void 0 ? _a : "unknown")) {
            return res.status(429).json({
                message: "You are saving designs too quickly. Please try again in a few minutes.",
            });
        }
        const body = ((_b = req.body) !== null && _b !== void 0 ? _b : {});
        const { categorySlug, spaceSlug, essentialIds, positions } = body;
        if (typeof categorySlug !== "string" || !SLUG.test(categorySlug)) {
            return res.status(400).json({ message: "A valid categorySlug is required" });
        }
        if (spaceSlug !== undefined &&
            spaceSlug !== null &&
            (typeof spaceSlug !== "string" || !SLUG.test(spaceSlug))) {
            return res.status(400).json({ message: "Invalid spaceSlug" });
        }
        if (!Array.isArray(essentialIds) ||
            essentialIds.length < 1 ||
            essentialIds.length > MAX_PIECES ||
            !essentialIds.every((id) => typeof id === "string" && OBJECT_ID.test(id))) {
            return res
                .status(400)
                .json({ message: `Add between 1 and ${MAX_PIECES} pieces to save a design` });
        }
        const cleanPositions = {};
        if (positions !== undefined && positions !== null) {
            if (typeof positions !== "object" || Array.isArray(positions)) {
                return res.status(400).json({ message: "Invalid positions" });
            }
            const entries = Object.entries(positions);
            if (entries.length > MAX_PIECES) {
                return res.status(400).json({ message: "Too many positions" });
            }
            for (const [key, value] of entries) {
                const cleaned = PIECE_KEY.test(key) ? cleanPosition(value) : null;
                if (!cleaned)
                    return res.status(400).json({ message: "Invalid positions" });
                cleanPositions[key] = cleaned;
            }
        }
        const roomWidthCm = optionalNumber(body.roomWidthCm, 150, 1200);
        const roomHeightCm = optionalNumber(body.roomHeightCm, 200, 500);
        // same limits as the frontend's depth field (MIN / MAX_ROOM_DEPTH_CM)
        const roomDepthCm = optionalNumber(body.roomDepthCm, 150, 1200);
        if (roomWidthCm === undefined || roomHeightCm === undefined || roomDepthCm === undefined) {
            return res.status(400).json({ message: "Invalid room size" });
        }
        const wallId = optionalToken(body.wallId);
        const floorId = optionalToken(body.floorId);
        if (wallId === undefined || floorId === undefined) {
            return res.status(400).json({ message: "Invalid colours" });
        }
        // The category and every product must be real (a design can't be used to
        // store arbitrary ids), and every product must belong to that category.
        const uniqueIds = [...new Set(essentialIds)];
        const [category, found] = yield Promise.all([
            categoryModel_1.Categories.exists({ slug: categorySlug }),
            essentialModel_1.Essentials.countDocuments({
                _id: { $in: uniqueIds.map((id) => new mongoose_1.default.Types.ObjectId(id)) },
                categorySlugs: categorySlug,
            }),
        ]);
        if (!category)
            return res.status(404).json({ message: "Category not found" });
        if (found !== uniqueIds.length) {
            return res
                .status(400)
                .json({ message: "Some of those pieces are not available in this category" });
        }
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const shortId = makeShortId();
            try {
                yield designModel_1.Designs.create({
                    shortId,
                    categorySlug,
                    spaceSlug: spaceSlug !== null && spaceSlug !== void 0 ? spaceSlug : null,
                    essentialIds,
                    positions: cleanPositions,
                    roomWidthCm,
                    roomHeightCm,
                    roomDepthCm,
                    wallId,
                    floorId,
                });
                return res.status(201).json({ id: shortId });
            }
            catch (error) {
                // A duplicate shortId (vanishingly rare): try another one.
                if (error.code !== 11000)
                    throw error;
            }
        }
        return res.status(500).json({ message: "Could not save the design" });
    }
    catch (error) {
        console.error("Failed to save design:", error);
        return res.status(500).json({ message: "Could not save the design" });
    }
}));
router.get("/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d, _e, _f, _g, _h, _j;
    try {
        const { id } = req.params;
        if (!SHORT_ID.test(id))
            return res.status(404).json({ message: "Design not found" });
        const design = yield designModel_1.Designs.findOne({ shortId: id });
        if (!design)
            return res.status(404).json({ message: "Design not found" });
        return res.json({
            id: design.shortId,
            categorySlug: design.categorySlug,
            spaceSlug: (_c = design.spaceSlug) !== null && _c !== void 0 ? _c : null,
            essentialIds: design.essentialIds.map((essentialId) => essentialId.toString()),
            positions: (_d = design.positions) !== null && _d !== void 0 ? _d : {},
            roomWidthCm: (_e = design.roomWidthCm) !== null && _e !== void 0 ? _e : null,
            roomHeightCm: (_f = design.roomHeightCm) !== null && _f !== void 0 ? _f : null,
            roomDepthCm: (_g = design.roomDepthCm) !== null && _g !== void 0 ? _g : null,
            wallId: (_h = design.wallId) !== null && _h !== void 0 ? _h : null,
            floorId: (_j = design.floorId) !== null && _j !== void 0 ? _j : null,
        });
    }
    catch (error) {
        console.error("Failed to fetch design:", error);
        return res.status(500).json({ message: "Could not load the design" });
    }
}));
exports.default = router;
