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
const vendorApplicationModel_1 = require("../models/vendorApplicationModel");
const vendorDetailModel_1 = require("../models/vendorDetailModel");
const userModels_1 = require("../models/userModels");
const featureFlags_1 = require("../services/featureFlags");
// "Sell on Go Renovate": a signed-in customer applies, an admin approves or rejects.
// Approving creates a NEW vendor profile (never a seeded one) and makes the applicant a vendor.
// The role and vendorId are only ever set here, by the server, never copied from a request body.
const router = express_1.default.Router();
router.use(authMiddleware_1.requireAuth);
const MAX_REASON_LENGTH = 300;
const GST_MESSAGE = "That GST number does not look right. Leave it empty if you do not have one.";
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
function text(value, min, max) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim().replace(/\s+/g, " ");
    return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}
// Accepts 10-digit Indian mobiles with an optional +91 / 91 / 0 prefix; stores the 10 digits.
function indianMobile(value) {
    if (typeof value !== "string")
        return null;
    const digits = value.replace(/[\s-]/g, "");
    const match = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(digits);
    return match ? match[1] : null;
}
function validateApplication(body) {
    const errors = {};
    const businessName = text(body.businessName, 2, 80);
    if (!businessName)
        errors.businessName = "Enter your business name (2 to 80 characters).";
    const city = text(body.city, 2, 60);
    if (!city)
        errors.city = "Enter the city you work from.";
    // While services are switched off the form no longer asks what is sold: every applicant sells products.
    const sells = typeof body.sells === "string" && body.sells ? body.sells : (0, featureFlags_1.servicesEnabled)() ? "" : "products";
    if (!vendorApplicationModel_1.SELLS_OPTIONS.includes(sells)) {
        errors.sells = "Choose whether you offer services, products or both.";
    }
    const phone = indianMobile(body.phone);
    if (!phone)
        errors.phone = "Enter a 10-digit Indian mobile number.";
    const pickupAddress = text(body.pickupAddress, 10, 300);
    if (!pickupAddress)
        errors.pickupAddress = "Enter your address (at least 10 characters).";
    let gstin = "";
    if (typeof body.gstin === "string") {
        gstin = body.gstin.trim().toUpperCase();
        if (gstin !== "" && !GSTIN_PATTERN.test(gstin))
            errors.gstin = GST_MESSAGE;
    }
    else if (body.gstin !== undefined && body.gstin !== null) {
        errors.gstin = GST_MESSAGE;
    }
    return { errors, values: { businessName, city, sells, phone, pickupAddress, gstin } };
}
function publicApplication(doc) {
    var _a, _b;
    return {
        id: String(doc._id),
        businessName: doc.businessName,
        city: doc.city,
        sells: doc.sells,
        phone: doc.phone,
        pickupAddress: doc.pickupAddress,
        gstin: doc.gstin || "",
        status: doc.status,
        rejectionReason: doc.rejectionReason || "",
        vendorId: (_a = doc.vendorId) !== null && _a !== void 0 ? _a : null,
        createdAt: doc.createdAt,
        decidedAt: (_b = doc.decidedAt) !== null && _b !== void 0 ? _b : null,
    };
}
// Some older accounts store their numeric userId as text. A normal Mongoose query casts the id to a
// number and would miss them, so find the row with the raw driver, then load the full document.
function findUserDocument(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const raw = yield userModels_1.Users.collection.findOne({ userId: { $in: [userId, String(userId)] } }, { projection: { _id: 1 } });
        return raw ? userModels_1.Users.findById(raw._id) : null;
    });
}
// Apply to sell.
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const current = yield (0, requireRole_1.loadCurrentUser)(req);
        if (!current)
            return res.status(401).json({ message: "Invalid session" });
        if (current.role === "admin") {
            return res.status(403).json({ message: "Admin accounts cannot apply to sell." });
        }
        if (current.role === "vendor") {
            return res.status(409).json({ message: "Your account is already a vendor." });
        }
        const { errors, values } = validateApplication((_a = req.body) !== null && _a !== void 0 ? _a : {});
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ message: "Please fix the highlighted fields.", errors });
        }
        const open = yield vendorApplicationModel_1.VendorApplications.findOne({ userId: current.userId, status: "pending" });
        if (open) {
            return res.status(409).json({ message: "You already have an application waiting for review." });
        }
        const created = yield vendorApplicationModel_1.VendorApplications.create(Object.assign(Object.assign({}, values), { userId: current.userId, userEmail: current.userEmail }));
        return res.status(201).json({ application: publicApplication(created) });
    }
    catch (error) {
        console.error("Failed to submit vendor application:", error);
        return res.status(500).json({ message: "We could not submit your application. Please try again." });
    }
}));
// The signed-in user's latest application (null if they never applied).
router.get("/mine", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const current = yield (0, requireRole_1.loadCurrentUser)(req);
        if (!current)
            return res.status(401).json({ message: "Invalid session" });
        const latest = yield vendorApplicationModel_1.VendorApplications.findOne({ userId: current.userId }).sort({ createdAt: -1 });
        return res.json({ application: latest ? publicApplication(latest) : null });
    }
    catch (error) {
        console.error("Failed to load vendor application:", error);
        return res.status(500).json({ message: "We could not load your application. Please try again." });
    }
}));
// ---- admin only from here ----
router.get("/", (0, requireRole_1.requireRole)("admin"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const wanted = typeof req.query.status === "string" ? req.query.status : "pending";
        const filter = ["pending", "approved", "rejected"].includes(wanted) ? { status: wanted } : {};
        const applications = yield vendorApplicationModel_1.VendorApplications.find(filter).sort({ createdAt: 1 }).limit(200);
        return res.json({
            applications: applications.map((doc) => (Object.assign(Object.assign({}, publicApplication(doc)), { userEmail: doc.userEmail }))),
        });
    }
    catch (error) {
        console.error("Failed to list vendor applications:", error);
        return res.status(500).json({ message: "Could not load applications. Please try again." });
    }
}));
router.post("/:id/approve", (0, requireRole_1.requireRole)("admin"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!mongoose_1.default.isValidObjectId(id))
        return res.status(404).json({ message: "Application not found" });
    let claimed = null;
    let createdVendorId = null;
    try {
        // Claim it first so two clicks (or two admins) cannot approve the same application twice.
        claimed = yield vendorApplicationModel_1.VendorApplications.findOneAndUpdate({ _id: id, status: "pending" }, { status: "approved", decidedAt: new Date() }, { new: true });
        if (!claimed) {
            const exists = yield vendorApplicationModel_1.VendorApplications.exists({ _id: id });
            return res
                .status(exists ? 409 : 404)
                .json({ message: exists ? "This application was already decided." : "Application not found" });
        }
        const user = yield findUserDocument(claimed.userId);
        if (!user || user.get("role") === "vendor") {
            yield vendorApplicationModel_1.VendorApplications.updateOne({ _id: id }, { status: "pending", $unset: { decidedAt: 1 } });
            return res.status(409).json({
                message: user ? "The applicant is already a vendor." : "The applicant's account no longer exists.",
            });
        }
        const vendorId = `v-${claimed._id}`;
        yield vendorDetailModel_1.VendorDetails.create({
            id: vendorId,
            name: claimed.businessName,
            tagline: "",
            // A new vendor starts with no track record. Only the server/admin may ever change these.
            rating: 0,
            reviewCount: 0,
            completedProjects: 0,
            yearsActive: 0,
            location: claimed.city,
            responseTime: "",
            verified: false,
            badges: [],
            categories: [],
            status: "active",
            source: "application",
            ownerUserId: claimed.userId,
            approvedAt: new Date(),
        });
        createdVendorId = vendorId;
        user.set("role", "vendor");
        user.set("vendorId", vendorId);
        yield user.save();
        yield vendorApplicationModel_1.VendorApplications.updateOne({ _id: id }, { vendorId });
        return res.json({ application: publicApplication(Object.assign(Object.assign({}, claimed.toObject()), { vendorId })) });
    }
    catch (error) {
        console.error("Failed to approve vendor application:", error);
        // Undo whatever got done so the application can be approved again.
        try {
            if (createdVendorId)
                yield vendorDetailModel_1.VendorDetails.deleteOne({ id: createdVendorId, source: "application" });
            if (claimed)
                yield vendorApplicationModel_1.VendorApplications.updateOne({ _id: id }, { status: "pending", $unset: { decidedAt: 1 } });
        }
        catch (undoError) {
            console.error("Could not undo a failed approval:", undoError);
        }
        return res.status(500).json({ message: "Could not approve this application. Please try again." });
    }
}));
router.post("/:id/reject", (0, requireRole_1.requireRole)("admin"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id))
            return res.status(404).json({ message: "Application not found" });
        const reason = typeof ((_b = req.body) === null || _b === void 0 ? void 0 : _b.reason) === "string" ? req.body.reason.trim().slice(0, MAX_REASON_LENGTH) : "";
        const rejected = yield vendorApplicationModel_1.VendorApplications.findOneAndUpdate({ _id: id, status: "pending" }, { status: "rejected", rejectionReason: reason, decidedAt: new Date() }, { new: true });
        if (!rejected) {
            const exists = yield vendorApplicationModel_1.VendorApplications.exists({ _id: id });
            return res
                .status(exists ? 409 : 404)
                .json({ message: exists ? "This application was already decided." : "Application not found" });
        }
        return res.json({ application: publicApplication(rejected) });
    }
    catch (error) {
        console.error("Failed to reject vendor application:", error);
        return res.status(500).json({ message: "Could not reject this application. Please try again." });
    }
}));
// Owner-only testing shortcut: attach one of your own test accounts to a DEMO (seeded) vendor so the
// vendor side can be tried without applying. Refuses real vendors created through sign-up.
router.post("/admin/link", (0, requireRole_1.requireRole)("admin"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d;
    try {
        const userId = Number((_c = req.body) === null || _c === void 0 ? void 0 : _c.userId);
        const vendorId = typeof ((_d = req.body) === null || _d === void 0 ? void 0 : _d.vendorId) === "string" ? req.body.vendorId.trim() : "";
        if (!Number.isInteger(userId) || !vendorId) {
            return res.status(400).json({ message: "userId (a number) and vendorId are required." });
        }
        const vendor = yield vendorDetailModel_1.VendorDetails.findOne({ id: vendorId });
        if (!vendor)
            return res.status(404).json({ message: "Vendor not found" });
        if (vendor.get("source") === "application") {
            return res.status(409).json({ message: "Real vendors cannot be linked by hand." });
        }
        const owner = vendor.get("ownerUserId");
        if (owner != null && owner !== userId) {
            return res.status(409).json({ message: "That vendor already belongs to another account." });
        }
        const user = yield findUserDocument(userId);
        if (!user)
            return res.status(404).json({ message: "User not found" });
        const admin = req.currentUser;
        if (admin.userId === userId) {
            return res.status(409).json({ message: "Use a separate test account, not your admin account." });
        }
        if (user.get("role") === "vendor" && user.get("vendorId") !== vendorId) {
            return res.status(409).json({ message: "That account is already linked to another vendor." });
        }
        user.set("role", "vendor");
        user.set("vendorId", vendorId);
        yield user.save();
        vendor.set("ownerUserId", userId);
        yield vendor.save();
        return res.json({ ok: true, userId, vendorId });
    }
    catch (error) {
        console.error("Failed to link test vendor:", error);
        return res.status(500).json({ message: "Could not link that account. Please try again." });
    }
}));
router.post("/admin/unlink", (0, requireRole_1.requireRole)("admin"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _e;
    try {
        const userId = Number((_e = req.body) === null || _e === void 0 ? void 0 : _e.userId);
        if (!Number.isInteger(userId))
            return res.status(400).json({ message: "userId (a number) is required." });
        const user = yield findUserDocument(userId);
        if (!user || user.get("role") !== "vendor") {
            return res.status(404).json({ message: "That account is not linked to a vendor." });
        }
        const vendor = yield vendorDetailModel_1.VendorDetails.findOne({ id: user.get("vendorId") });
        if ((vendor === null || vendor === void 0 ? void 0 : vendor.get("source")) === "application") {
            return res.status(409).json({ message: "Real vendors cannot be unlinked by hand." });
        }
        user.set("role", "customer");
        user.set("vendorId", null);
        yield user.save();
        if (vendor && vendor.get("ownerUserId") === userId) {
            vendor.set("ownerUserId", null);
            yield vendor.save();
        }
        return res.json({ ok: true });
    }
    catch (error) {
        console.error("Failed to unlink test vendor:", error);
        return res.status(500).json({ message: "Could not unlink that account. Please try again." });
    }
}));
exports.default = router;
