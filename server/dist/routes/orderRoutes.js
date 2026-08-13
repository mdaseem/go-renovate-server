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
const orderModel_1 = require("../models/orderModel");
const userModels_1 = require("../models/userModels");
const vendorDetailModel_1 = require("../models/vendorDetailModel");
const shiprocketService_1 = require("../services/shiprocketService");
const router = express_1.default.Router();
// requireAuth sets req.user = decoded, and the token is signed as
// { name: userFound } (a pre-existing quirk of authorizeUser.ts), so the
// actual user fields live one level down at req.user.name.
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
const MAX_NOTE_LENGTH = 500;
function generateOrderNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `GR-${timestamp}${random}`;
}
function isDuplicateKeyError(error) {
    return (typeof error === "object" &&
        error !== null &&
        error.code === 11000);
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
    try {
        const { userId, userEmail, userName } = getAuthedUser(req);
        if (!userEmail) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { vendorId, items, address } = req.body;
        if (!isNonEmptyString(vendorId)) {
            return res.status(400).json({ message: "vendorId is required" });
        }
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "At least one item is required" });
        }
        if (items.length > MAX_ITEMS_PER_ORDER) {
            return res
                .status(400)
                .json({ message: `An order can include at most ${MAX_ITEMS_PER_ORDER} items` });
        }
        const addressError = validateAddress(address);
        if (addressError) {
            return res.status(400).json(addressError);
        }
        const vendor = yield vendorDetailModel_1.VendorDetails.findOne({ id: vendorId });
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }
        // Prices/names/etc. always come from the vendor's own catalog, never
        // from the client — only the requested quantity is trusted from the
        // request body, so a tampered client payload can't under-price an order.
        const catalog = new Map();
        const categories = vendor.get("categories") || [];
        for (const category of categories) {
            for (const service of category.services || []) {
                catalog.set(service.id, { service, categoryLabel: category.label });
            }
        }
        const resolvedItems = [];
        for (const item of items) {
            if (!isNonEmptyString(item.serviceId)) {
                return res.status(400).json({ message: "Each item needs a serviceId" });
            }
            const quantity = Number(item.quantity);
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
                return res.status(400).json({
                    message: `Quantity for ${item.serviceId} must be between 1 and ${MAX_QUANTITY_PER_ITEM}`,
                });
            }
            const catalogEntry = catalog.get(item.serviceId);
            if (!catalogEntry) {
                return res.status(400).json({
                    message: `Service ${item.serviceId} is not offered by this vendor`,
                });
            }
            resolvedItems.push({
                serviceId: catalogEntry.service.id,
                name: catalogEntry.service.name,
                description: catalogEntry.service.description,
                price: catalogEntry.service.price,
                unit: catalogEntry.service.unit,
                quantity,
                categoryLabel: catalogEntry.categoryLabel,
                imageUrl: catalogEntry.service.imageUrl,
            });
        }
        const subtotal = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        let order;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                order = yield orderModel_1.Orders.create({
                    orderNumber: generateOrderNumber(),
                    userId,
                    userEmail,
                    userName,
                    vendorId: vendor.get("id"),
                    vendorName: vendor.get("name"),
                    items: resolvedItems,
                    subtotal,
                    total: subtotal,
                    address,
                    status: "PLACED",
                    statusHistory: [{ status: "PLACED", changedAt: new Date() }],
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
        // Best-effort — remembering the address for next time shouldn't fail
        // the order itself if it errors.
        userModels_1.Users.updateOne({ userEmail }, { $set: { address } }).catch((error) => {
            console.error("Failed to save address to user profile:", error);
        });
        return res.status(201).json(order);
    }
    catch (error) {
        console.error("Failed to create order:", error);
        return res.status(500).json({ message: "Failed to create order" });
    }
}));
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userEmail } = getAuthedUser(req);
        if (!userEmail) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const orders = yield orderModel_1.Orders.find({ userEmail })
            .sort({ createdAt: -1 })
            .select("orderNumber vendorName status total items createdAt");
        const summaries = orders.map((order) => ({
            id: order._id,
            orderNumber: order.get("orderNumber"),
            vendorName: order.get("vendorName"),
            status: order.get("status"),
            total: order.get("total"),
            itemCount: (order.get("items") || []).length,
            createdAt: order.get("createdAt"),
        }));
        return res.json(summaries);
    }
    catch (error) {
        console.error("Failed to list orders:", error);
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
        const order = yield orderModel_1.Orders.findOne({ _id: req.params.id, userEmail });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        return res.json(order);
    }
    catch (error) {
        console.error("Failed to fetch order:", error);
        return res.status(500).json({ message: "Failed to fetch order" });
    }
}));
router.patch("/:id/status", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userEmail } = getAuthedUser(req);
        if (!userEmail) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid order id" });
        }
        const { status, note: rawNote } = req.body;
        if (!status || !(status in orderModel_1.ORDER_STATUS_TRANSITIONS)) {
            return res.status(400).json({ message: "Invalid status" });
        }
        if (rawNote !== undefined && typeof rawNote !== "string") {
            return res.status(400).json({ message: "note must be a string" });
        }
        const note = typeof rawNote === "string"
            ? rawNote.trim().slice(0, MAX_NOTE_LENGTH)
            : undefined;
        const order = yield orderModel_1.Orders.findOne({ _id: req.params.id, userEmail });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        const currentStatus = order.get("status");
        const allowedNext = orderModel_1.ORDER_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowedNext.includes(status)) {
            return res.status(400).json({
                message: `Cannot move order from ${currentStatus} to ${status}`,
            });
        }
        order.set("status", status);
        order.get("statusHistory").push({
            status,
            note,
            changedAt: new Date(),
        });
        if (status === "APPROVED") {
            try {
                const result = yield (0, shiprocketService_1.createAdhocOrder)({
                    orderNumber: order.get("orderNumber"),
                    total: order.get("total"),
                    items: order.get("items"),
                    address: order.get("address"),
                });
                order.set("shiprocket", {
                    orderId: result.shiprocketOrderId,
                    shipmentId: result.shipmentId,
                    status: "created",
                });
                order.set("status", "SHIPMENT_CREATED");
                order.get("statusHistory").push({
                    status: "SHIPMENT_CREATED",
                    note: "Shiprocket shipment created automatically on approval",
                    changedAt: new Date(),
                });
            }
            catch (shipError) {
                if (shipError instanceof shiprocketService_1.ShiprocketNotConfiguredError) {
                    order.get("statusHistory").push({
                        status: "APPROVED",
                        note: "Shiprocket not configured — shipment creation skipped",
                        changedAt: new Date(),
                    });
                }
                else {
                    console.error("Shiprocket order creation failed:", shipError);
                    order.get("statusHistory").push({
                        status: "APPROVED",
                        note: "Shiprocket shipment creation failed — can be retried",
                        changedAt: new Date(),
                    });
                }
            }
        }
        yield order.save();
        return res.json(order);
    }
    catch (error) {
        console.error("Failed to update order status:", error);
        return res.status(500).json({ message: "Failed to update order status" });
    }
}));
exports.default = router;
