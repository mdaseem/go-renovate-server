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
const mongoose_1 = __importDefault(require("mongoose"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const requireRole_1 = require("../middleware/requireRole");
const essentialModel_1 = require("../models/essentialModel");
const productVisibility_1 = require("../services/productVisibility");
const productTypes_1 = require("../services/productTypes");
const vendorProductRules_1 = require("../services/vendorProductRules");
const vendorNameLookup_1 = require("../services/vendorNameLookup");
const vendorProductRoutes_1 = require("./vendorProductRoutes");
// The owner's review of products vendors created: approve (optionally also show it in the room
// designer), reject with a reason, pause or resume any vendor product, and switch rooms on or off.
// Admin-only (ADMIN_EMAILS). These routes only ever touch products created by vendors (`source: "vendor"`),
// never the seeded catalogue.
const router = express_1.default.Router();
router.use(authMiddleware_1.requireAuth, (0, requireRole_1.requireRole)("admin"));
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;
const VENDOR_ONLY = { source: "vendor" };
function adminView(doc, types, vendorNames) {
    var _a, _b, _c;
    return Object.assign(Object.assign({}, (0, vendorProductRoutes_1.toProductView)(doc, types)), { vendorId: doc.vendorId, vendorName: (_a = vendorNames.get(doc.vendorId)) !== null && _a !== void 0 ? _a : "Unknown vendor", 
        // Rooms the product could be shown in, by its type (empty for "Other").
        possibleRooms: (_c = (_b = types.get(doc.slot)) === null || _b === void 0 ? void 0 : _b.rooms) !== null && _c !== void 0 ? _c : [] });
}
function respondWith(res, doc, status = 200) {
    return __awaiter(this, void 0, void 0, function* () {
        const types = yield (0, productTypes_1.loadProductTypes)();
        const names = yield (0, vendorNameLookup_1.getVendorNameMap)([doc.vendorId]);
        return res.status(status).json({ product: adminView(doc, types, names) });
    });
}
function counts() {
    return __awaiter(this, void 0, void 0, function* () {
        const grouped = yield essentialModel_1.Essentials.aggregate([
            { $match: VENDOR_ONLY },
            { $group: { _id: "$status", n: { $sum: 1 } } },
        ]);
        const result = { pending: 0, live: 0, paused: 0, rejected: 0 };
        for (const row of grouped)
            result[(0, productVisibility_1.effectiveStatus)(row._id)] += row.n;
        return result;
    });
}
// --- GET /admin/products?status=pending|live|paused|rejected&before=&limit=   (default: pending)
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const status = typeof req.query.status === "string" ? req.query.status : "pending";
        if (!["pending", "live", "paused", "rejected"].includes(status)) {
            return res.status(400).json({ message: "Unknown status" });
        }
        const before = typeof req.query.before === "string" ? req.query.before : "";
        if (before && !mongoose_1.default.isValidObjectId(before))
            return res.status(400).json({ message: "Invalid page marker" });
        const rawLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : DEFAULT_PAGE_SIZE;
        const limit = Number.isInteger(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
        const filter = Object.assign(Object.assign({}, VENDOR_ONLY), { status });
        if (before)
            filter._id = { $lt: new mongoose_1.default.Types.ObjectId(before) };
        // Oldest waiting first for the review queue, newest first elsewhere.
        const sortDir = status === "pending" ? 1 : -1;
        if (before && status === "pending")
            filter._id = { $gt: new mongoose_1.default.Types.ObjectId(before) };
        const [page, types, totals] = yield Promise.all([
            essentialModel_1.Essentials.find(filter).sort({ _id: sortDir }).limit(limit + 1).lean(),
            (0, productTypes_1.loadProductTypes)(),
            counts(),
        ]);
        const hasMore = page.length > limit;
        const rows = page.slice(0, limit);
        const names = yield (0, vendorNameLookup_1.getVendorNameMap)(rows.map((row) => row.vendorId));
        return res.json({
            products: rows.map((row) => adminView(row, types, names)),
            nextCursor: hasMore ? String(rows[rows.length - 1]._id) : null,
            counts: totals,
        });
    }
    catch (error) {
        console.error("Failed to list products for review:", error);
        return res.status(500).json({ message: "We could not load the products. Please try again." });
    }
}));
// Atomic claim of a state change on a vendor-created product; null when it was not in an allowed state.
function claim(id, fromStatuses, set, unset = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const update = { $set: set };
        if (Object.keys(unset).length > 0)
            update.$unset = unset;
        return essentialModel_1.Essentials.findOneAndUpdate(Object.assign(Object.assign({ _id: id }, VENDOR_ONLY), { status: { $in: fromStatuses } }), update, {
            new: true,
            lean: true,
        });
    });
}
function notFoundOrConflict(res, id, message) {
    return __awaiter(this, void 0, void 0, function* () {
        const exists = yield essentialModel_1.Essentials.exists(Object.assign({ _id: id }, VENDOR_ONLY));
        if (!exists)
            return res.status(404).json({ message: "Product not found" });
        return res.status(409).json({ message });
    });
}
const validId = (id) => mongoose_1.default.isValidObjectId(id);
// --- POST /admin/products/:id/approve  { showInRooms?: boolean }   pending -> live
router.post("/:id/approve", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        if (!validId(req.params.id))
            return res.status(404).json({ message: "Product not found" });
        const showInRooms = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.showInRooms) === true;
        const set = { status: "live", approvedAt: new Date(), reviewedAt: new Date() };
        if (showInRooms) {
            const product = (yield essentialModel_1.Essentials.findOne(Object.assign(Object.assign({ _id: req.params.id }, VENDOR_ONLY), { status: "pending" }), { slot: 1 }).lean());
            const rooms = (_d = (_c = (yield (0, productTypes_1.loadProductTypes)()).get((_b = product === null || product === void 0 ? void 0 : product.slot) !== null && _b !== void 0 ? _b : productTypes_1.OTHER_TYPE_ID)) === null || _c === void 0 ? void 0 : _c.rooms) !== null && _d !== void 0 ? _d : [];
            if (product && rooms.length === 0) {
                return res.status(400).json({ message: "This product type cannot be shown in rooms.", errors: { showInRooms: "Products of type Other cannot be shown in rooms." } });
            }
            set.categorySlugs = rooms;
        }
        const updated = yield claim(req.params.id, ["pending"], set, { reviewNote: "" });
        if (!updated)
            return notFoundOrConflict(res, req.params.id, "This product is not waiting for review.");
        return respondWith(res, updated);
    }
    catch (error) {
        console.error("Failed to approve product:", error);
        return res.status(500).json({ message: "We could not approve this product. Please try again." });
    }
}));
// --- POST /admin/products/:id/reject  { reason }   pending -> rejected
router.post("/:id/reject", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _e;
    try {
        if (!validId(req.params.id))
            return res.status(404).json({ message: "Product not found" });
        const reason = (0, vendorProductRules_1.parseReason)((_e = req.body) === null || _e === void 0 ? void 0 : _e.reason);
        if (!reason.ok)
            return res.status(400).json({ message: reason.error, errors: { reason: reason.error } });
        const updated = yield claim(req.params.id, ["pending"], { status: "rejected", reviewNote: reason.reason, reviewedAt: new Date() });
        if (!updated)
            return notFoundOrConflict(res, req.params.id, "This product is not waiting for review.");
        return respondWith(res, updated);
    }
    catch (error) {
        console.error("Failed to reject product:", error);
        return res.status(500).json({ message: "We could not reject this product. Please try again." });
    }
}));
// --- POST /admin/products/:id/pause   live -> paused (by the owner: the vendor cannot undo it)
router.post("/:id/pause", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!validId(req.params.id))
            return res.status(404).json({ message: "Product not found" });
        const updated = yield essentialModel_1.Essentials.findOneAndUpdate(Object.assign(Object.assign({ _id: req.params.id }, VENDOR_ONLY), { status: { $nin: productVisibility_1.NOT_PUBLIC_PRODUCT_STATUSES } }), { $set: { status: "paused", pausedBy: "admin" } }, { new: true, lean: true });
        if (!updated)
            return notFoundOrConflict(res, req.params.id, "Only a live product can be paused.");
        return respondWith(res, updated);
    }
    catch (error) {
        console.error("Failed to pause product:", error);
        return res.status(500).json({ message: "We could not pause this product. Please try again." });
    }
}));
// --- POST /admin/products/:id/resume   paused -> live (whoever paused it)
router.post("/:id/resume", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!validId(req.params.id))
            return res.status(404).json({ message: "Product not found" });
        const updated = yield claim(req.params.id, ["paused"], { status: "live" }, { pausedBy: "" });
        if (!updated)
            return notFoundOrConflict(res, req.params.id, "Only a paused product can be put back on sale.");
        return respondWith(res, updated);
    }
    catch (error) {
        console.error("Failed to resume product:", error);
        return res.status(500).json({ message: "We could not put this product back on sale. Please try again." });
    }
}));
// --- POST /admin/products/:id/rooms  { enabled: boolean }   show the product in its type's rooms, or take it out
router.post("/:id/rooms", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _f, _g, _h, _j;
    try {
        if (!validId(req.params.id))
            return res.status(404).json({ message: "Product not found" });
        if (typeof ((_f = req.body) === null || _f === void 0 ? void 0 : _f.enabled) !== "boolean") {
            return res.status(400).json({ message: "Say whether to show it in rooms.", errors: { enabled: "Choose on or off." } });
        }
        const existing = (yield essentialModel_1.Essentials.findOne(Object.assign(Object.assign({ _id: req.params.id }, VENDOR_ONLY), { status: { $in: ["live", "paused"] } }), { slot: 1 }).lean());
        if (!existing)
            return notFoundOrConflict(res, req.params.id, "Approve the product before putting it in rooms.");
        const rooms = req.body.enabled ? (_j = (_h = (yield (0, productTypes_1.loadProductTypes)()).get((_g = existing.slot) !== null && _g !== void 0 ? _g : productTypes_1.OTHER_TYPE_ID)) === null || _h === void 0 ? void 0 : _h.rooms) !== null && _j !== void 0 ? _j : [] : [];
        if (req.body.enabled && rooms.length === 0) {
            return res.status(400).json({ message: "This product type cannot be shown in rooms.", errors: { enabled: "Products of type Other cannot be shown in rooms." } });
        }
        const updated = yield essentialModel_1.Essentials.findOneAndUpdate(Object.assign(Object.assign({ _id: req.params.id }, VENDOR_ONLY), { status: { $in: ["live", "paused"] } }), { $set: { categorySlugs: rooms } }, { new: true, lean: true });
        if (!updated)
            return res.status(404).json({ message: "Product not found" });
        return respondWith(res, updated);
    }
    catch (error) {
        console.error("Failed to change rooms for product:", error);
        return res.status(500).json({ message: "We could not change that. Please try again." });
    }
}));
exports.default = router;
