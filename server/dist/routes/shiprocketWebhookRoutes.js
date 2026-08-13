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
const orderModel_1 = require("../models/orderModel");
const router = express_1.default.Router();
const STATUS_MAP = {
    "PICKED UP": "PICKUP_SCHEDULED",
    "PICKUP SCHEDULED": "PICKUP_SCHEDULED",
    "IN TRANSIT": "IN_TRANSIT",
    "OUT FOR DELIVERY": "IN_TRANSIT",
    DELIVERED: "DELIVERED",
    CANCELLED: "CANCELLED",
    CANCELED: "CANCELLED",
};
// Unauthenticated — Shiprocket calls this directly with no bearer token.
// Always responds 200 so an event we intentionally ignore (unknown order,
// unmapped status, illegal transition) doesn't trigger a retry storm.
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { awb, order_id: shiprocketOrderId, current_status: currentStatus } = req.body;
        const mappedStatus = currentStatus
            ? STATUS_MAP[currentStatus.toUpperCase()]
            : undefined;
        if (!mappedStatus || (!awb && !shiprocketOrderId)) {
            return res.status(200).json({ received: true, applied: false });
        }
        const order = awb
            ? yield orderModel_1.Orders.findOne({ "shiprocket.awbCode": awb })
            : yield orderModel_1.Orders.findOne({ "shiprocket.orderId": shiprocketOrderId });
        if (!order) {
            console.warn("Shiprocket webhook: no matching order for", {
                awb,
                shiprocketOrderId,
            });
            return res.status(200).json({ received: true, applied: false });
        }
        const current = order.get("status");
        const allowedNext = orderModel_1.ORDER_STATUS_TRANSITIONS[current] || [];
        if (!allowedNext.includes(mappedStatus)) {
            return res.status(200).json({ received: true, applied: false });
        }
        order.set("status", mappedStatus);
        order.get("statusHistory").push({
            status: mappedStatus,
            note: `Updated via Shiprocket webhook (${currentStatus})`,
            changedAt: new Date(),
        });
        if (order.get("shiprocket")) {
            order.set("shiprocket.status", currentStatus);
        }
        yield order.save();
        return res.status(200).json({ received: true, applied: true });
    }
    catch (error) {
        console.error("Shiprocket webhook processing failed:", error);
        return res.status(200).json({ received: true, applied: false });
    }
}));
exports.default = router;
