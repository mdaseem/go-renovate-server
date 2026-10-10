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
const essentialOrderModel_1 = require("../models/essentialOrderModel");
const essentialModel_1 = require("../models/essentialModel");
const vendorNameLookup_1 = require("../services/vendorNameLookup");
const orderModel_1 = require("../models/orderModel");
const router = express_1.default.Router();
// requireAuth sets req.user = decoded, and the token is signed as
// { name: userFound } (a pre-existing quirk of authorizeUser.ts, matching
// orderRoutes.ts's own getAuthedUser), so the actual user fields live one
// level down at req.user.name.
function getAuthedUser(req) {
    const decoded = req.user;
    const userFound = (decoded === null || decoded === void 0 ? void 0 : decoded.name) || {};
    return {
        userId: userFound.userId,
        userEmail: userFound.userEmail,
        userName: userFound.userName,
    };
}
function isValidObjectId(id) {
    return mongoose_1.default.Types.ObjectId.isValid(id);
}
const MAX_ITEMS_PER_ORDER = 50;
const MAX_QUANTITY_PER_ITEM = 999;
const PHONE_PATTERN = /^\d{10}$/;
const PINCODE_PATTERN = /^\d{6}$/;
function generateOrderNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `GR-RM-${timestamp}${random}`;
}
function isDuplicateKeyError(error) {
    return (typeof error === "object" &&
        error !== null &&
        error.code === 11000);
}
// Puts back units taken by a checkout that then failed (stock shortage on a
// later item, or the order document failing to save).
function releaseStock(reserved) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all(reserved.map(({ id, qty }) => essentialModel_1.Essentials.updateOne({ _id: id }, { $inc: { stock: qty } })));
    });
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function validateAddress(address) {
    if (typeof address !== "object" || address === null) {
        return { message: "A shipping address is required" };
    }
    const a = address;
    if (!isNonEmptyString(a.contactName)) {
        return { message: "Contact name is required" };
    }
    if (!isNonEmptyString(a.phone) || !PHONE_PATTERN.test(a.phone.trim())) {
        return { message: "A valid 10-digit phone number is required" };
    }
    if (!isNonEmptyString(a.line1)) {
        return { message: "Address line 1 is required" };
    }
    if (!isNonEmptyString(a.city)) {
        return { message: "City is required" };
    }
    if (!isNonEmptyString(a.state)) {
        return { message: "State is required" };
    }
    if (!isNonEmptyString(a.pincode) || !PINCODE_PATTERN.test(a.pincode.trim())) {
        return { message: "A valid 6-digit pincode is required" };
    }
    return null;
}
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { userId, userEmail, userName } = getAuthedUser(req);
        if (!userEmail) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { items, address } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "At least one item is required" });
        }
        if (items.length > MAX_ITEMS_PER_ORDER) {
            return res.status(400).json({
                message: `An order can include at most ${MAX_ITEMS_PER_ORDER} items`,
            });
        }
        const addressError = validateAddress(address);
        if (addressError) {
            return res.status(400).json(addressError);
        }
        const requestedIds = [];
        for (const item of items) {
            if (!isNonEmptyString(item.essentialId) ||
                !isValidObjectId(item.essentialId)) {
                return res
                    .status(400)
                    .json({ message: "Each item needs a valid essentialId" });
            }
            requestedIds.push(item.essentialId);
        }
        // Prices/names always come from the essentials catalog, never the
        // client — only the requested quantity is trusted from the request
        // body, so a tampered client payload can't under-price an order.
        const essentials = yield essentialModel_1.Essentials.find({ _id: { $in: requestedIds } });
        const essentialById = new Map(essentials.map((essential) => [essential._id.toString(), essential]));
        const vendorGroups = new Map();
        for (const item of items) {
            const essentialId = item.essentialId;
            const quantity = Number(item.quantity);
            if (!Number.isInteger(quantity) ||
                quantity < 1 ||
                quantity > MAX_QUANTITY_PER_ITEM) {
                return res.status(400).json({
                    message: `Quantity for ${essentialId} must be between 1 and ${MAX_QUANTITY_PER_ITEM}`,
                });
            }
            const essential = essentialById.get(essentialId);
            if (!essential) {
                return res
                    .status(400)
                    .json({ message: `Item ${essentialId} is not available` });
            }
            const vendorId = essential.get("vendorId");
            if (!vendorGroups.has(vendorId)) {
                vendorGroups.set(vendorId, { items: [], subtotal: 0 });
            }
            const group = vendorGroups.get(vendorId);
            const price = essential.get("price");
            const images = essential.get("images") || [];
            group.items.push({
                essentialId,
                name: essential.get("name"),
                price,
                quantity,
                imageUrl: images[0],
            });
            group.subtotal += price * quantity;
        }
        // Reserve stock atomically per item: the `stock: { $gte: qty }` guard in
        // the filter makes the check-and-decrement a single operation, so two
        // simultaneous checkouts can't both take the last unit. Untracked
        // (no `stock` field) and external-store items are skipped.
        const quantityById = new Map();
        for (const item of items) {
            const id = item.essentialId;
            quantityById.set(id, ((_a = quantityById.get(id)) !== null && _a !== void 0 ? _a : 0) + Number(item.quantity));
        }
        const reserved = [];
        const outOfStock = [];
        for (const [id, qty] of quantityById) {
            const essential = essentialById.get(id);
            if (!essential ||
                essential.get("purchaseMode") === "external-store" ||
                typeof essential.get("stock") !== "number") {
                continue;
            }
            const result = yield essentialModel_1.Essentials.updateOne({ _id: id, stock: { $gte: qty } }, { $inc: { stock: -qty } });
            if (result.modifiedCount === 1) {
                reserved.push({ id, qty });
            }
            else {
                outOfStock.push(essential.get("name"));
            }
        }
        if (outOfStock.length > 0) {
            yield releaseStock(reserved);
            return res.status(409).json({
                message: `Not enough stock for: ${outOfStock.join(", ")}. Please swap these items and try again.`,
            });
        }
        const vendorNameById = yield (0, vendorNameLookup_1.getVendorNameMap)(Array.from(vendorGroups.keys()));
        const vendorOrders = Array.from(vendorGroups.entries()).map(([vendorId, group]) => {
            var _a;
            return ({
                vendorId,
                vendorName: (_a = vendorNameById.get(vendorId)) !== null && _a !== void 0 ? _a : "Unknown vendor",
                items: group.items,
                subtotal: group.subtotal,
                status: "PLACED",
                statusHistory: [{ status: "PLACED", changedAt: new Date() }],
            });
        });
        const total = vendorOrders.reduce((sum, vendorOrder) => sum + vendorOrder.subtotal, 0);
        let order;
        try {
            for (let attempt = 0; attempt < 3; attempt += 1) {
                try {
                    order = yield essentialOrderModel_1.EssentialOrders.create({
                        orderNumber: generateOrderNumber(),
                        userId,
                        userEmail,
                        userName,
                        address,
                        total,
                        vendorOrders,
                    });
                    break;
                }
                catch (createError) {
                    if (isDuplicateKeyError(createError) && attempt < 2) {
                        continue;
                    }
                    throw createError;
                }
            }
        }
        catch (saveError) {
            yield releaseStock(reserved);
            throw saveError;
        }
        return res.status(201).json(order);
    }
    catch (error) {
        console.error("Failed to create essential order:", error);
        return res.status(500).json({ message: "Failed to create order" });
    }
}));
// A Room order has no single status of its own — it splits into N
// independent per-vendor sub-orders, each shipping (and progressing)
// separately. For a one-line list-card summary, the honest signal is
// whichever sub-order the customer is still actually waiting on: the
// earliest (least-advanced) active status, not the most-advanced one
// (which would overclaim progress on the whole order). REJECTED/CANCELLED
// sub-orders are excluded from that ranking unless every sub-order ended
// that way, in which case the aggregate reflects that terminal state.
function computeAggregateStatus(statuses) {
    const active = statuses.filter((status) => status !== "REJECTED" && status !== "CANCELLED");
    if (active.length === 0) {
        return statuses.every((status) => status === "CANCELLED")
            ? "CANCELLED"
            : "REJECTED";
    }
    return active.reduce((earliest, current) => orderModel_1.ORDER_STATUS_STEPS.indexOf(current) < orderModel_1.ORDER_STATUS_STEPS.indexOf(earliest)
        ? current
        : earliest);
}
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userEmail } = getAuthedUser(req);
        if (!userEmail) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const orders = yield essentialOrderModel_1.EssentialOrders.find({ userEmail })
            .sort({ createdAt: -1 })
            .select("orderNumber total vendorOrders createdAt");
        const summaries = orders.map((order) => {
            const vendorOrders = order.get("vendorOrders") || [];
            const itemCount = vendorOrders.reduce((sum, vendorOrder) => { var _a; return sum + (((_a = vendorOrder.items) === null || _a === void 0 ? void 0 : _a.length) || 0); }, 0);
            const status = computeAggregateStatus(vendorOrders.map((vendorOrder) => vendorOrder.status || "PLACED"));
            return {
                id: order._id,
                orderNumber: order.get("orderNumber"),
                total: order.get("total"),
                vendorCount: vendorOrders.length,
                itemCount,
                status,
                createdAt: order.get("createdAt"),
            };
        });
        return res.json(summaries);
    }
    catch (error) {
        console.error("Failed to list essential orders:", error);
        return res.status(500).json({ message: "Failed to list orders" });
    }
}));
router.get("/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userEmail } = getAuthedUser(req);
        if (!userEmail) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid order id" });
        }
        const order = yield essentialOrderModel_1.EssentialOrders.findOne({
            _id: req.params.id,
            userEmail,
        });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        return res.json(order);
    }
    catch (error) {
        console.error("Failed to fetch essential order:", error);
        return res.status(500).json({ message: "Failed to fetch order" });
    }
}));
exports.default = router;
