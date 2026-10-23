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
const essentialOrderModel_1 = require("../models/essentialOrderModel");
const essentialModel_1 = require("../models/essentialModel");
const vendorOrderRules_1 = require("../services/vendorOrderRules");
// The vendor order inbox: a vendor sees only the orders that contain THEIR products and moves their own
// part through New -> Accepted -> Shipped -> Delivered (or declines / cancels with a reason).
// The vendor id always comes from the database (requireRole), never from the request, and a vendor is
// never sent another vendor's items, the order total, or the buyer's email or account id.
const router = express_1.default.Router();
router.use(authMiddleware_1.requireAuth, (0, requireRole_1.requireRole)("vendor"));
// Delivery addresses and phone numbers: never cache these responses.
router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
function currentVendorId(req) {
    const { vendorId } = req.currentUser;
    return typeof vendorId === "string" && vendorId ? vendorId : null;
}
// What one vendor may see of an order. The list omits the street address and phone (the card only
// needs the city); the detail page, used to pack and ship, includes them.
function toView(order, vendorId, detail) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    const mine = order.vendorOrders.find((entry) => entry.vendorId === vendorId);
    if (!mine)
        return null;
    const items = ((_a = mine.items) !== null && _a !== void 0 ? _a : []).map((item) => {
        var _a, _b, _c, _d;
        return ({
            essentialId: item.essentialId ? String(item.essentialId) : null,
            name: (_a = item.name) !== null && _a !== void 0 ? _a : "",
            price: (_b = item.price) !== null && _b !== void 0 ? _b : 0,
            quantity: (_c = item.quantity) !== null && _c !== void 0 ? _c : 0,
            imageUrl: (_d = item.imageUrl) !== null && _d !== void 0 ? _d : null,
        });
    });
    const address = (_b = order.address) !== null && _b !== void 0 ? _b : {};
    return {
        id: String(order._id),
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        status: mine.status,
        stage: (0, vendorOrderRules_1.stageOf)(mine.status),
        subtotal: (_c = mine.subtotal) !== null && _c !== void 0 ? _c : 0,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        items,
        delivery: detail
            ? {
                contactName: (_d = address.contactName) !== null && _d !== void 0 ? _d : "",
                phone: (_e = address.phone) !== null && _e !== void 0 ? _e : "",
                line1: (_f = address.line1) !== null && _f !== void 0 ? _f : "",
                line2: (_g = address.line2) !== null && _g !== void 0 ? _g : "",
                city: (_h = address.city) !== null && _h !== void 0 ? _h : "",
                state: (_j = address.state) !== null && _j !== void 0 ? _j : "",
                pincode: (_k = address.pincode) !== null && _k !== void 0 ? _k : "",
            }
            : { city: (_l = address.city) !== null && _l !== void 0 ? _l : "", state: (_m = address.state) !== null && _m !== void 0 ? _m : "" },
        statusHistory: ((_o = mine.statusHistory) !== null && _o !== void 0 ? _o : []).map((entry) => {
            var _a;
            return ({
                status: entry.status,
                note: (_a = entry.note) !== null && _a !== void 0 ? _a : "",
                changedAt: entry.changedAt,
            });
        }),
        shipment: mine.shiprocket
            ? {
                courierName: (_p = mine.shiprocket.courierName) !== null && _p !== void 0 ? _p : "",
                trackingNumber: (_q = mine.shiprocket.awbCode) !== null && _q !== void 0 ? _q : "",
                trackingUrl: (_r = mine.shiprocket.trackingUrl) !== null && _r !== void 0 ? _r : "",
            }
            : null,
    };
}
function stageCounts(vendorId) {
    return __awaiter(this, void 0, void 0, function* () {
        const grouped = yield essentialOrderModel_1.EssentialOrders.aggregate([
            { $match: { "vendorOrders.vendorId": vendorId } },
            { $unwind: "$vendorOrders" },
            { $match: { "vendorOrders.vendorId": vendorId } },
            { $group: { _id: "$vendorOrders.status", n: { $sum: 1 } } },
        ]);
        const counts = { new: 0, accepted: 0, shipped: 0, delivered: 0, closed: 0 };
        for (const row of grouped)
            counts[(0, vendorOrderRules_1.stageOf)(row._id)] += row.n;
        return counts;
    });
}
// Puts the stock reserved at checkout back after a decline/cancel. Only tracked, on-platform items were
// ever reserved. Runs once, by whichever request won the status change; failures are logged, not hidden.
function releaseReservedStock(orderId, sub) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            for (const item of (_a = sub.items) !== null && _a !== void 0 ? _a : []) {
                if (!item.essentialId || !item.quantity)
                    continue;
                yield essentialModel_1.Essentials.updateOne({ _id: item.essentialId, purchaseMode: { $ne: "external-store" }, stock: { $type: "number" } }, { $inc: { stock: item.quantity } });
            }
            yield essentialOrderModel_1.EssentialOrders.updateOne({ _id: orderId, "vendorOrders._id": sub._id }, { $set: { "vendorOrders.$.stockReleasedAt": new Date() } });
        }
        catch (error) {
            console.error(`Failed to put stock back for order ${orderId} (vendor sub-order ${sub._id}):`, error);
        }
    });
}
// --- GET /vendor/orders/summary: the counts behind the badge and the tabs (cheap, no order data)
router.get("/summary", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json({ message: "Your account is not linked to a vendor profile." });
        return res.json({ counts: yield stageCounts(vendorId) });
    }
    catch (error) {
        console.error("Failed to load vendor order summary:", error);
        return res.status(500).json({ message: "We could not load your orders. Please try again." });
    }
}));
// --- GET /vendor/orders?stage=&before=&limit=: newest first, paged by order id
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json({ message: "Your account is not linked to a vendor profile." });
        const stage = typeof req.query.stage === "string" ? req.query.stage : "all";
        if (stage !== "all" && !vendorOrderRules_1.VENDOR_STAGES.includes(stage)) {
            return res.status(400).json({ message: "Unknown stage" });
        }
        const before = typeof req.query.before === "string" ? req.query.before : "";
        if (before && !mongoose_1.default.isValidObjectId(before)) {
            return res.status(400).json({ message: "Invalid page marker" });
        }
        const rawLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : DEFAULT_PAGE_SIZE;
        const limit = Number.isInteger(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
        const mineMatch = { vendorId };
        if (stage !== "all")
            mineMatch.status = { $in: vendorOrderRules_1.STAGE_STATUSES[stage] };
        const filter = { vendorOrders: { $elemMatch: mineMatch } };
        if (before)
            filter._id = { $lt: new mongoose_1.default.Types.ObjectId(before) };
        const page = (yield essentialOrderModel_1.EssentialOrders.find(filter, {
            orderNumber: 1,
            createdAt: 1,
            "address.city": 1,
            "address.state": 1,
            vendorOrders: 1,
        })
            .sort({ _id: -1 })
            .limit(limit + 1)
            .lean());
        const hasMore = page.length > limit;
        const rows = page.slice(0, limit);
        const orders = rows
            .map((order) => toView(order, vendorId, false))
            .filter((view) => view !== null);
        return res.json({
            orders,
            nextCursor: hasMore ? String(rows[rows.length - 1]._id) : null,
            counts: yield stageCounts(vendorId),
        });
    }
    catch (error) {
        console.error("Failed to list vendor orders:", error);
        return res.status(500).json({ message: "We could not load your orders. Please try again." });
    }
}));
// --- GET /vendor/orders/:orderId: one order, this vendor's part only, with the delivery details
router.get("/:orderId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json({ message: "Your account is not linked to a vendor profile." });
        if (!mongoose_1.default.isValidObjectId(req.params.orderId)) {
            return res.status(404).json({ message: "Order not found" });
        }
        const order = (yield essentialOrderModel_1.EssentialOrders.findOne({ _id: req.params.orderId, "vendorOrders.vendorId": vendorId }, { orderNumber: 1, createdAt: 1, address: 1, vendorOrders: 1 }).lean());
        const view = order ? toView(order, vendorId, true) : null;
        if (!view)
            return res.status(404).json({ message: "Order not found" });
        return res.json({ order: view });
    }
    catch (error) {
        console.error("Failed to load vendor order:", error);
        return res.status(500).json({ message: "We could not load this order. Please try again." });
    }
}));
// --- PATCH /vendor/orders/:orderId/status  { action, reason?, note?, courierName?, trackingNumber?, trackingUrl? }
// The change is claimed with ONE atomic update that also checks the current status, so a double tap or
// two open tabs cannot apply it twice, and an action that no longer fits answers 409.
router.patch("/:orderId/status", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vendorId = currentVendorId(req);
        if (!vendorId)
            return res.status(403).json({ message: "Your account is not linked to a vendor profile." });
        const orderId = req.params.orderId;
        if (!mongoose_1.default.isValidObjectId(orderId)) {
            return res.status(404).json({ message: "Order not found" });
        }
        const parsed = (0, vendorOrderRules_1.parseVendorAction)(req.body);
        if (!parsed.ok) {
            return res.status(400).json({ message: "Please check the details and try again.", errors: parsed.errors });
        }
        const { action, historyNote, shipment } = parsed.value;
        const rule = vendorOrderRules_1.VENDOR_ACTIONS[action];
        const set = { "vendorOrders.$[mine].status": rule.to };
        if (shipment) {
            set["vendorOrders.$[mine].shiprocket"] = {
                courierName: shipment.courierName,
                awbCode: shipment.trackingNumber,
                trackingUrl: shipment.trackingUrl,
            };
        }
        const entry = { status: rule.to, changedAt: new Date(), by: "vendor" };
        if (historyNote)
            entry.note = historyNote;
        const updated = (yield essentialOrderModel_1.EssentialOrders.findOneAndUpdate({ _id: orderId, vendorOrders: { $elemMatch: { vendorId, status: { $in: rule.from } } } }, { $set: set, $push: { "vendorOrders.$[mine].statusHistory": entry } }, {
            new: true,
            arrayFilters: [{ "mine.vendorId": vendorId, "mine.status": { $in: rule.from } }],
            lean: true,
        }));
        if (!updated) {
            // Nothing changed: either this is not the vendor's order (404) or it has already moved on (409).
            const current = (yield essentialOrderModel_1.EssentialOrders.findOne({ _id: orderId, "vendorOrders.vendorId": vendorId }, { vendorOrders: 1 }).lean());
            const mine = current === null || current === void 0 ? void 0 : current.vendorOrders.find((entry) => entry.vendorId === vendorId);
            if (!mine)
                return res.status(404).json({ message: "Order not found" });
            return res.status(409).json({
                message: "This order has already moved on. Refresh to see its latest status.",
                stage: (0, vendorOrderRules_1.stageOf)(mine.status),
            });
        }
        const sub = updated.vendorOrders.find((entry) => entry.vendorId === vendorId);
        if (sub && (rule.to === "REJECTED" || rule.to === "CANCELLED")) {
            yield releaseReservedStock(String(updated._id), sub);
        }
        const view = toView(updated, vendorId, true);
        return res.json({ order: view, counts: yield stageCounts(vendorId) });
    }
    catch (error) {
        console.error("Failed to update vendor order:", error);
        return res.status(500).json({ message: "We could not update this order. Please try again." });
    }
}));
exports.default = router;
