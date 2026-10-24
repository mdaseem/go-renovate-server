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
exports.toProductView = void 0;
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const requireRole_1 = require("../middleware/requireRole");
const essentialModel_1 = require("../models/essentialModel");
const productVisibility_1 = require("../services/productVisibility");
const productTypes_1 = require("../services/productTypes");
const rateWindow_1 = require("../services/rateWindow");
const cloudinary_1 = require("../services/cloudinary");
const vendorProductRules_1 = require("../services/vendorProductRules");
// The vendor's own products: add, edit, pause, resume, duplicate. Every route is vendor-only and works on
// products whose `vendorId` is the vendor's own, read from the database (requireRole), never from the
// request. A new product starts "pending" and is not public until the owner approves it
// (routes/adminProductRoutes.ts). Photos: the phone uploads straight to Cloudinary with a ticket from
// POST /photo-ticket, then POST /:id/photos asks Cloudinary what arrived and saves the address
// (services/cloudinary.ts). A product without photos shows the default placeholder.
const router = express_1.default.Router();
router.use(authMiddleware_1.requireAuth, (0, requireRole_1.requireRole)("vendor"));
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;
// Creating (or duplicating) products: 30 an hour per vendor.
const createWindow = (0, rateWindow_1.makeRateWindow)(30, 60 * 60 * 1000);
// Photos: upload tickets and attach checks, per vendor per hour. The attach check calls Cloudinary's
// admin API, which has a small hourly quota for the whole account, so keep these modest.
const ticketWindow = (0, rateWindow_1.makeRateWindow)(40, 60 * 60 * 1000);
const attachWindow = (0, rateWindow_1.makeRateWindow)(40, 60 * 60 * 1000);
function currentVendorId(req) {
    const { vendorId } = req.currentUser;
    return typeof vendorId === "string" && vendorId ? vendorId : null;
}
const NO_PROFILE = { message: "Your account is not linked to a vendor profile." };
function toProductView(doc, types) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    const images = ((_a = doc.images) !== null && _a !== void 0 ? _a : []).filter(Boolean);
    const imageUrl = (_c = (_b = images[0]) !== null && _b !== void 0 ? _b : doc.cutoutUrl) !== null && _c !== void 0 ? _c : null;
    const type = types.get((_d = doc.slot) !== null && _d !== void 0 ? _d : "");
    const dims = doc.dimensionsCm;
    return {
        id: String(doc._id),
        name: (_e = doc.name) !== null && _e !== void 0 ? _e : "",
        description: (_f = doc.description) !== null && _f !== void 0 ? _f : "",
        slot: (_g = doc.slot) !== null && _g !== void 0 ? _g : productTypes_1.OTHER_TYPE_ID,
        typeLabel: (_h = type === null || type === void 0 ? void 0 : type.label) !== null && _h !== void 0 ? _h : ((_j = doc.slot) !== null && _j !== void 0 ? _j : "Other"),
        icon: (_k = type === null || type === void 0 ? void 0 : type.icon) !== null && _k !== void 0 ? _k : "📦",
        price: (_l = doc.price) !== null && _l !== void 0 ? _l : 0,
        stock: typeof doc.stock === "number" ? doc.stock : null,
        dimensionsCm: dims && typeof dims.w === "number" && typeof dims.h === "number" ? { w: dims.w, h: dims.h, d: (_m = dims.d) !== null && _m !== void 0 ? _m : null } : null,
        status: (0, productVisibility_1.effectiveStatus)(doc.status),
        pausedBy: (_o = doc.pausedBy) !== null && _o !== void 0 ? _o : null,
        reviewNote: (_p = doc.reviewNote) !== null && _p !== void 0 ? _p : "",
        hasPhoto: Boolean(imageUrl),
        imageUrl,
        // The vendor's own uploaded photos, in order (the first one is the main picture).
        photos: images,
        inRooms: ((_q = doc.categorySlugs) !== null && _q !== void 0 ? _q : []).length > 0,
        createdByVendor: doc.source === "vendor",
        submittedAt: (_r = doc.submittedAt) !== null && _r !== void 0 ? _r : null,
        approvedAt: (_s = doc.approvedAt) !== null && _s !== void 0 ? _s : null,
        createdAt: doc._id.getTimestamp(),
    };
}
exports.toProductView = toProductView;
function statusCounts(vendorId) {
    return __awaiter(this, void 0, void 0, function* () {
        const grouped = yield essentialModel_1.Essentials.aggregate([
            { $match: { vendorId } },
            { $group: { _id: "$status", n: { $sum: 1 } } },
        ]);
        const counts = { pending: 0, live: 0, paused: 0, rejected: 0 };
        for (const row of grouped)
            counts[(0, productVisibility_1.effectiveStatus)(row._id)] += row.n;
        return counts;
    });
}
function productFilterForStatus(status) {
    if (status === "all")
        return {};
    if (status === "live")
        return { status: { $nin: productVisibility_1.NOT_PUBLIC_PRODUCT_STATUSES } };
    if (status === "pending" || status === "paused" || status === "rejected")
        return { status };
    return null;
}
// --- GET /vendor/products/options: the product types a vendor can pick, and the limits the form shows
router.get("/options", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const types = yield (0, productTypes_1.loadProductTypes)();
        return res.json({
            types: Array.from(types.values()).map(({ id, label, icon }) => ({ id, label, icon })),
            maxProducts: vendorProductRules_1.MAX_PRODUCTS_PER_VENDOR,
            photos: {
                enabled: (0, cloudinary_1.getCloudinaryConfig)() !== null,
                maxPerProduct: cloudinary_1.PHOTO_LIMITS.maxPerProduct,
                maxBytes: cloudinary_1.PHOTO_LIMITS.maxBytes,
                minSide: cloudinary_1.PHOTO_LIMITS.minSide,
            },
        });
    }
    catch (error) {
        console.error("Failed to load product types:", error);
        return res.status(500).json({ message: "We could not load the product types. Please try again." });
    }
}));
// --- GET /vendor/products?status=&before=&limit=
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json(NO_PROFILE);
        const status = typeof req.query.status === "string" ? req.query.status : "all";
        const statusFilter = productFilterForStatus(status);
        if (!statusFilter)
            return res.status(400).json({ message: "Unknown status" });
        const before = typeof req.query.before === "string" ? req.query.before : "";
        if (before && !mongoose_1.default.isValidObjectId(before))
            return res.status(400).json({ message: "Invalid page marker" });
        const rawLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : DEFAULT_PAGE_SIZE;
        const limit = Number.isInteger(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
        const filter = Object.assign({ vendorId }, statusFilter);
        if (before)
            filter._id = { $lt: new mongoose_1.default.Types.ObjectId(before) };
        const [page, types, counts] = yield Promise.all([
            essentialModel_1.Essentials.find(filter).sort({ _id: -1 }).limit(limit + 1).lean(),
            (0, productTypes_1.loadProductTypes)(),
            statusCounts(vendorId),
        ]);
        const hasMore = page.length > limit;
        const rows = page.slice(0, limit);
        return res.json({
            products: rows.map((doc) => toProductView(doc, types)),
            nextCursor: hasMore ? String(rows[rows.length - 1]._id) : null,
            counts,
        });
    }
    catch (error) {
        console.error("Failed to list vendor products:", error);
        return res.status(500).json({ message: "We could not load your products. Please try again." });
    }
}));
// --- POST /vendor/products: add a product (it starts "pending")
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json(NO_PROFILE);
        const types = yield (0, productTypes_1.loadProductTypes)();
        const parsed = (0, vendorProductRules_1.parseProductInput)(req.body, { mode: "create", allowedTypes: new Set(types.keys()) });
        if (!parsed.ok) {
            return res.status(400).json({ message: "Please check the details and try again.", errors: parsed.errors });
        }
        const owned = yield essentialModel_1.Essentials.countDocuments({ vendorId, status: { $ne: "rejected" } });
        if (owned >= vendorProductRules_1.MAX_PRODUCTS_PER_VENDOR) {
            return res.status(409).json({ message: `You have reached the limit of ${vendorProductRules_1.MAX_PRODUCTS_PER_VENDOR} products.` });
        }
        if (!createWindow.take(vendorId)) {
            return res.status(429).json({ message: "You are adding products very quickly. Please wait a few minutes and try again." });
        }
        const { name, description, slot, price, stock, dimensionsCm } = parsed.fields;
        const created = yield essentialModel_1.Essentials.create(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ name }, (description ? { description } : {})), { slot,
            price }), (typeof stock === "number" ? { stock } : {})), (dimensionsCm ? { dimensionsCm } : {})), { vendorId, images: [], categorySlugs: [], purchaseMode: "on-platform", status: "pending", source: "vendor", submittedAt: new Date() }));
        return res.status(201).json({ product: toProductView(created.toObject(), types), warnings: parsed.warnings });
    }
    catch (error) {
        console.error("Failed to add product:", error);
        return res.status(500).json({ message: "We could not save your product. Please try again." });
    }
}));
// --- POST /vendor/products/photo-ticket: permission to upload ONE photo into the vendor's own folder
// Needs no product yet, so photos can be picked while the form is still being filled in.
router.post("/photo-ticket", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json(NO_PROFILE);
        const config = (0, cloudinary_1.getCloudinaryConfig)();
        if (!config)
            return res.status(503).json({ message: "Photo upload is not available right now. Please try again later." });
        if (!ticketWindow.take(vendorId)) {
            return res.status(429).json({ message: "You are uploading photos very quickly. Please wait a few minutes and try again." });
        }
        const ticket = (0, cloudinary_1.createUploadTicket)(config, vendorId);
        if (!ticket)
            return res.status(403).json(NO_PROFILE);
        res.set("Cache-Control", "no-store");
        return res.json(ticket);
    }
    catch (error) {
        console.error("Failed to create a photo ticket:", error);
        return res.status(500).json({ message: "We could not start the upload. Please try again." });
    }
}));
const PHOTO_PROBLEMS = {
    missing: { status: 400, message: "We couldn't find that photo. Please upload it again." },
    format: { status: 400, message: "Photos must be JPG, PNG or WebP." },
    size: { status: 400, message: `That photo is too large. The limit is ${cloudinary_1.PHOTO_LIMITS.maxBytes / (1024 * 1024)} MB.` },
    dimensions: {
        status: 400,
        message: `Photos must be between ${cloudinary_1.PHOTO_LIMITS.minSide} and ${cloudinary_1.PHOTO_LIMITS.maxSide} pixels on each side.`,
    },
    unavailable: { status: 502, message: "We couldn't check your photo right now. Please try again." },
};
// --- POST /vendor/products/:id/photos  { publicId }: add an uploaded photo to the product
// The id must sit in this vendor's own folder; Cloudinary is asked what it really holds there, and the
// address saved comes from its answer. Repeating the same call changes nothing.
router.post("/:id/photos", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json(NO_PROFILE);
        if (!mongoose_1.default.isValidObjectId(req.params.id))
            return res.status(404).json({ message: "Product not found" });
        const config = (0, cloudinary_1.getCloudinaryConfig)();
        if (!config)
            return res.status(503).json({ message: "Photo upload is not available right now. Please try again later." });
        const publicId = (_a = req.body) === null || _a === void 0 ? void 0 : _a.publicId;
        if (!(0, cloudinary_1.isOwnPhotoId)(vendorId, publicId)) {
            return res.status(400).json({ message: "That photo doesn't belong to your account.", errors: { photos: "Upload the photo again." } });
        }
        const existing = (yield essentialModel_1.Essentials.findOne({ _id: req.params.id, vendorId }, { images: 1 }).lean());
        if (!existing)
            return res.status(404).json({ message: "Product not found" });
        if (((_b = existing.images) !== null && _b !== void 0 ? _b : []).length >= cloudinary_1.PHOTO_LIMITS.maxPerProduct) {
            return res.status(409).json({ message: `A product can have up to ${cloudinary_1.PHOTO_LIMITS.maxPerProduct} photos.` });
        }
        if (!attachWindow.take(vendorId)) {
            return res.status(429).json({ message: "You are adding photos very quickly. Please wait a few minutes and try again." });
        }
        const check = yield (0, cloudinary_1.checkUploadedPhoto)(config, publicId);
        if (!check.ok) {
            const problem = PHOTO_PROBLEMS[check.reason];
            // A file that arrived but breaks the rules is removed so it does not sit in the account unused.
            if (check.reason === "format" || check.reason === "size" || check.reason === "dimensions") {
                void (0, cloudinary_1.deleteUploadedPhoto)(config, publicId);
            }
            return res.status(problem.status).json({ message: problem.message, errors: { photos: problem.message } });
        }
        const types = yield (0, productTypes_1.loadProductTypes)();
        const lastSlot = cloudinary_1.PHOTO_LIMITS.maxPerProduct - 1;
        let updated = (yield essentialModel_1.Essentials.findOneAndUpdate({ _id: req.params.id, vendorId, images: { $ne: check.url }, [`images.${lastSlot}`]: { $exists: false } }, { $push: { images: check.url } }, { new: true, lean: true }));
        if (!updated) {
            // Already attached (a repeat of the same call) or the limit was reached by a parallel upload.
            const current = (yield essentialModel_1.Essentials.findOne({ _id: req.params.id, vendorId }).lean());
            if (!current)
                return res.status(404).json({ message: "Product not found" });
            if (((_c = current.images) !== null && _c !== void 0 ? _c : []).includes(check.url))
                return res.json({ product: toProductView(current, types) });
            return res.status(409).json({ message: `A product can have up to ${cloudinary_1.PHOTO_LIMITS.maxPerProduct} photos.` });
        }
        // Like any other edit, a photo added to a product the owner sent back puts it in review again.
        if (updated.status === "rejected") {
            const again = (yield essentialModel_1.Essentials.findOneAndUpdate({ _id: req.params.id, vendorId, status: "rejected" }, { $set: { status: "pending", submittedAt: new Date() }, $unset: { reviewNote: "", reviewedAt: "" } }, { new: true, lean: true }));
            if (again)
                updated = again;
        }
        return res.json({ product: toProductView(updated, types) });
    }
    catch (error) {
        console.error("Failed to add a product photo:", error);
        return res.status(500).json({ message: "We could not save your photo. Please try again." });
    }
}));
// --- POST /vendor/products/:id/photos/remove  { url }: take one photo off the product (and off Cloudinary)
router.post("/:id/photos/remove", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json(NO_PROFILE);
        if (!mongoose_1.default.isValidObjectId(req.params.id))
            return res.status(404).json({ message: "Product not found" });
        const url = (_d = req.body) === null || _d === void 0 ? void 0 : _d.url;
        if (typeof url !== "string" || url.length === 0 || url.length > 500) {
            return res.status(400).json({ message: "Say which photo to remove.", errors: { photos: "Say which photo to remove." } });
        }
        const updated = (yield essentialModel_1.Essentials.findOneAndUpdate({ _id: req.params.id, vendorId, images: url }, { $pull: { images: url } }, { new: true, lean: true }));
        if (!updated) {
            const exists = yield essentialModel_1.Essentials.exists({ _id: req.params.id, vendorId });
            if (!exists)
                return res.status(404).json({ message: "Product not found" });
            return res.status(409).json({ message: "That photo is no longer on this product." });
        }
        const config = (0, cloudinary_1.getCloudinaryConfig)();
        const publicId = config ? (0, cloudinary_1.publicIdFromUrl)(config, url) : null;
        if (config && publicId && (0, cloudinary_1.isOwnPhotoId)(vendorId, publicId))
            void (0, cloudinary_1.deleteUploadedPhoto)(config, publicId);
        return res.json({ product: toProductView(updated, yield (0, productTypes_1.loadProductTypes)()) });
    }
    catch (error) {
        console.error("Failed to remove a product photo:", error);
        return res.status(500).json({ message: "We could not remove that photo. Please try again." });
    }
}));
// --- GET /vendor/products/:id
router.get("/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json(NO_PROFILE);
        if (!mongoose_1.default.isValidObjectId(req.params.id))
            return res.status(404).json({ message: "Product not found" });
        const [doc, types] = yield Promise.all([
            essentialModel_1.Essentials.findOne({ _id: req.params.id, vendorId }).lean(),
            (0, productTypes_1.loadProductTypes)(),
        ]);
        if (!doc)
            return res.status(404).json({ message: "Product not found" });
        return res.json({ product: toProductView(doc, types) });
    }
    catch (error) {
        console.error("Failed to load product:", error);
        return res.status(500).json({ message: "We could not load this product. Please try again." });
    }
}));
// --- PATCH /vendor/products/:id: change any of name, description, type, price, stock, size
// Price and stock changes are live at once. A rejected product that is edited goes back to review.
router.patch("/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _e, _f;
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json(NO_PROFILE);
        if (!mongoose_1.default.isValidObjectId(req.params.id))
            return res.status(404).json({ message: "Product not found" });
        const [existing, types] = yield Promise.all([
            essentialModel_1.Essentials.findOne({ _id: req.params.id, vendorId }).lean(),
            (0, productTypes_1.loadProductTypes)(),
        ]);
        if (!existing)
            return res.status(404).json({ message: "Product not found" });
        const parsed = (0, vendorProductRules_1.parseProductInput)(req.body, {
            mode: "update",
            allowedTypes: new Set(types.keys()),
            existing: { slot: existing.slot, cutoutUrl: (_e = existing.cutoutUrl) !== null && _e !== void 0 ? _e : null, placement: (_f = existing.placement) !== null && _f !== void 0 ? _f : null },
        });
        if (!parsed.ok) {
            return res.status(400).json({ message: "Please check the details and try again.", errors: parsed.errors });
        }
        const set = {};
        const unset = {};
        const { name, description, slot, price, stock, dimensionsCm } = parsed.fields;
        if (name !== undefined)
            set.name = name;
        if (description !== undefined) {
            if (description)
                set.description = description;
            else
                unset.description = "";
        }
        if (slot !== undefined) {
            set.slot = slot;
            // A different type no longer fits the rooms the product was in: it leaves them until the owner adds it again.
            if (slot !== existing.slot)
                set.categorySlugs = [];
        }
        if (price !== undefined)
            set.price = price;
        if (stock !== undefined) {
            if (stock === null)
                unset.stock = "";
            else
                set.stock = stock;
        }
        if (dimensionsCm !== undefined) {
            if (dimensionsCm === null)
                unset.dimensionsCm = "";
            else
                set.dimensionsCm = dimensionsCm;
        }
        if (existing.status === "rejected") {
            set.status = "pending";
            set.submittedAt = new Date();
            unset.reviewNote = "";
            unset.reviewedAt = "";
        }
        const update = {};
        if (Object.keys(set).length > 0)
            update.$set = set;
        if (Object.keys(unset).length > 0)
            update.$unset = unset;
        const updated = (yield essentialModel_1.Essentials.findOneAndUpdate({ _id: req.params.id, vendorId }, update, {
            new: true,
            lean: true,
        }));
        if (!updated)
            return res.status(404).json({ message: "Product not found" });
        return res.json({ product: toProductView(updated, types), warnings: parsed.warnings });
    }
    catch (error) {
        console.error("Failed to update product:", error);
        return res.status(500).json({ message: "We could not save your changes. Please try again." });
    }
}));
// --- POST /vendor/products/:id/pause: take a live product off sale (atomic: only a live one can be paused)
router.post("/:id/pause", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json(NO_PROFILE);
        if (!mongoose_1.default.isValidObjectId(req.params.id))
            return res.status(404).json({ message: "Product not found" });
        const updated = (yield essentialModel_1.Essentials.findOneAndUpdate({ _id: req.params.id, vendorId, status: { $nin: productVisibility_1.NOT_PUBLIC_PRODUCT_STATUSES } }, { $set: { status: "paused", pausedBy: "vendor" } }, { new: true, lean: true }));
        if (!updated)
            return stateConflict(req, res, vendorId, "Only a live product can be paused.");
        return res.json({ product: toProductView(updated, yield (0, productTypes_1.loadProductTypes)()) });
    }
    catch (error) {
        console.error("Failed to pause product:", error);
        return res.status(500).json({ message: "We could not pause this product. Please try again." });
    }
}));
// --- POST /vendor/products/:id/resume: put a product the vendor paused back on sale (not one the owner paused)
router.post("/:id/resume", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json(NO_PROFILE);
        if (!mongoose_1.default.isValidObjectId(req.params.id))
            return res.status(404).json({ message: "Product not found" });
        const updated = (yield essentialModel_1.Essentials.findOneAndUpdate({ _id: req.params.id, vendorId, status: "paused", pausedBy: "vendor" }, { $set: { status: "live" }, $unset: { pausedBy: "" } }, { new: true, lean: true }));
        if (!updated) {
            const current = (yield essentialModel_1.Essentials.findOne({ _id: req.params.id, vendorId }, { status: 1, pausedBy: 1 }).lean());
            if (!current)
                return res.status(404).json({ message: "Product not found" });
            if (current.status === "paused" && current.pausedBy === "admin") {
                return res.status(409).json({ message: "Go Renovate paused this product. Please contact us to put it back on sale." });
            }
            return res.status(409).json({ message: "Only a product you paused can be put back on sale." });
        }
        return res.json({ product: toProductView(updated, yield (0, productTypes_1.loadProductTypes)()) });
    }
    catch (error) {
        console.error("Failed to resume product:", error);
        return res.status(500).json({ message: "We could not put this product back on sale. Please try again." });
    }
}));
// --- POST /vendor/products/:id/duplicate: a copy (for another colour or size) that goes to review
router.post("/:id/duplicate", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _g, _h, _j;
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json(NO_PROFILE);
        if (!mongoose_1.default.isValidObjectId(req.params.id))
            return res.status(404).json({ message: "Product not found" });
        const source = (yield essentialModel_1.Essentials.findOne({ _id: req.params.id, vendorId }).lean());
        if (!source)
            return res.status(404).json({ message: "Product not found" });
        const owned = yield essentialModel_1.Essentials.countDocuments({ vendorId, status: { $ne: "rejected" } });
        if (owned >= vendorProductRules_1.MAX_PRODUCTS_PER_VENDOR) {
            return res.status(409).json({ message: `You have reached the limit of ${vendorProductRules_1.MAX_PRODUCTS_PER_VENDOR} products.` });
        }
        if (!createWindow.take(vendorId)) {
            return res.status(429).json({ message: "You are adding products very quickly. Please wait a few minutes and try again." });
        }
        // Only the facts a vendor typed are copied: not the photos, cut-out, 3D model, rooms or review history.
        const suffix = " (copy)";
        const name = `${((_g = source.name) !== null && _g !== void 0 ? _g : "").slice(0, 100 - suffix.length)}${suffix}`;
        const copy = yield essentialModel_1.Essentials.create(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ name }, (source.description ? { description: source.description } : {})), { slot: source.slot, price: source.price }), (typeof source.stock === "number" ? { stock: source.stock } : {})), (((_h = source.dimensionsCm) === null || _h === void 0 ? void 0 : _h.w) && ((_j = source.dimensionsCm) === null || _j === void 0 ? void 0 : _j.h) ? { dimensionsCm: source.dimensionsCm } : {})), { vendorId, images: [], categorySlugs: [], purchaseMode: "on-platform", status: "pending", source: "vendor", submittedAt: new Date() }));
        return res.status(201).json({ product: toProductView(copy.toObject(), yield (0, productTypes_1.loadProductTypes)()) });
    }
    catch (error) {
        console.error("Failed to duplicate product:", error);
        return res.status(500).json({ message: "We could not copy this product. Please try again." });
    }
}));
// The product exists for this vendor but is in the wrong state for the action (409), or it is not theirs (404).
function stateConflict(req, res, vendorId, message) {
    return __awaiter(this, void 0, void 0, function* () {
        const current = yield essentialModel_1.Essentials.findOne({ _id: req.params.id, vendorId }, { _id: 1 }).lean();
        if (!current)
            return res.status(404).json({ message: "Product not found" });
        return res.status(409).json({ message });
    });
}
exports.default = router;
