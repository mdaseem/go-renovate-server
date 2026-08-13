"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Orders = exports.ORDER_STATUS_TRANSITIONS = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Schema = mongoose_1.default.Schema;
exports.ORDER_STATUS_TRANSITIONS = {
    PLACED: ["APPROVED", "REJECTED", "CANCELLED"],
    APPROVED: ["APPROVED", "SHIPMENT_CREATED", "CANCELLED"],
    SHIPMENT_CREATED: ["PICKUP_SCHEDULED", "CANCELLED"],
    PICKUP_SCHEDULED: ["IN_TRANSIT", "CANCELLED"],
    IN_TRANSIT: ["DELIVERED"],
    DELIVERED: [],
    REJECTED: [],
    CANCELLED: [],
};
const OrderItemSchema = new Schema({
    serviceId: String,
    name: String,
    description: String,
    price: Number,
    unit: String,
    quantity: Number,
    categoryLabel: String,
    imageUrl: String,
}, { _id: false });
const OrderAddressSchema = new Schema({
    contactName: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
}, { _id: false });
const OrderStatusHistorySchema = new Schema({
    status: { type: String, required: true },
    note: String,
    changedAt: { type: Date, default: Date.now },
}, { _id: false });
const ShiprocketInfoSchema = new Schema({
    orderId: String,
    shipmentId: String,
    awbCode: String,
    courierName: String,
    trackingUrl: String,
    status: String,
}, { _id: false });
const OrderSchema = new Schema({
    orderNumber: { type: String, required: true, unique: true },
    userId: Number,
    userEmail: { type: String, required: true },
    userName: String,
    vendorId: { type: String, required: true },
    vendorName: String,
    items: [OrderItemSchema],
    subtotal: Number,
    total: Number,
    address: OrderAddressSchema,
    status: { type: String, required: true, default: "PLACED" },
    statusHistory: [OrderStatusHistorySchema],
    shiprocket: { type: ShiprocketInfoSchema, default: null },
}, { timestamps: true });
OrderSchema.index({ userEmail: 1 });
OrderSchema.index({ status: 1 });
exports.Orders = mongoose_1.default.model("orders", OrderSchema, "orders");
