"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVendorAction = exports.REASON_TEXT = exports.VENDOR_ACTIONS = exports.stageOf = exports.STAGE_STATUSES = exports.VENDOR_STAGES = void 0;
exports.VENDOR_STAGES = ["new", "accepted", "shipped", "delivered", "closed"];
// Which internal statuses belong to each stage ("shipped" covers the Shiprocket steps too, so a later
// per-vendor Shiprocket flow lands in the right tab without a change here).
exports.STAGE_STATUSES = {
    new: ["PLACED"],
    accepted: ["APPROVED"],
    shipped: ["SHIPMENT_CREATED", "PICKUP_SCHEDULED", "IN_TRANSIT"],
    delivered: ["DELIVERED"],
    closed: ["REJECTED", "CANCELLED"],
};
function stageOf(status) {
    for (const stage of exports.VENDOR_STAGES) {
        if (exports.STAGE_STATUSES[stage].includes(status))
            return stage;
    }
    return "new";
}
exports.stageOf = stageOf;
// Compare-and-set table: an action only applies while the order is in one of its `from` statuses.
// "ship" goes straight to IN_TRANSIT (a vendor shipping by hand has no separate shipment/pickup steps).
exports.VENDOR_ACTIONS = {
    accept: { from: ["PLACED"], to: "APPROVED", needsReason: false },
    decline: { from: ["PLACED"], to: "REJECTED", needsReason: true },
    ship: { from: ["APPROVED"], to: "IN_TRANSIT", needsReason: false },
    deliver: { from: ["IN_TRANSIT"], to: "DELIVERED", needsReason: false },
    cancel: { from: ["APPROVED"], to: "CANCELLED", needsReason: true },
};
// Fixed reasons; the buyer sees the text. "OTHER" needs a short note from the vendor.
exports.REASON_TEXT = {
    OUT_OF_STOCK: "Out of stock",
    CANT_DELIVER: "Can't deliver to this pincode",
    OTHER: "Other",
};
const MAX_NOTE = 200;
const MAX_COURIER = 60;
const MAX_TRACKING_NUMBER = 60;
const MAX_TRACKING_URL = 300;
const TRACKING_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/;
function cleanText(value) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim().replace(/\s+/g, " ");
    return trimmed.length > 0 ? trimmed : null;
}
// Only https links are accepted for tracking (never javascript:, data:, http: or a link with a password in it).
function parseTrackingUrl(value) {
    if (value.length > MAX_TRACKING_URL)
        return null;
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes("."))
            return null;
        return url.toString();
    }
    catch (_a) {
        return null;
    }
}
// Validates a request body into a whitelisted action. Unknown fields are ignored, never copied.
function parseVendorAction(body) {
    const errors = {};
    const input = (typeof body === "object" && body !== null ? body : {});
    const action = typeof input.action === "string" ? input.action : "";
    if (!Object.prototype.hasOwnProperty.call(exports.VENDOR_ACTIONS, action)) {
        return { ok: false, errors: { action: "Choose what to do with this order." } };
    }
    const rule = exports.VENDOR_ACTIONS[action];
    const value = { action: action };
    if (rule.needsReason) {
        const code = typeof input.reason === "string" ? input.reason : "";
        if (!Object.prototype.hasOwnProperty.call(exports.REASON_TEXT, code)) {
            errors.reason = "Choose a reason.";
        }
        else if (code === "OTHER") {
            const note = cleanText(input.note);
            if (!note || note.length < 3)
                errors.note = "Add a few words so the buyer knows what happened.";
            else if (note.length > MAX_NOTE)
                errors.note = `Keep it under ${MAX_NOTE} characters.`;
            else
                value.historyNote = note;
        }
        else {
            value.historyNote = exports.REASON_TEXT[code];
        }
    }
    if (action === "ship") {
        const shipment = {};
        if (input.courierName !== undefined && input.courierName !== "") {
            const courier = cleanText(input.courierName);
            if (!courier || courier.length > MAX_COURIER)
                errors.courierName = `Courier name: up to ${MAX_COURIER} characters.`;
            else
                shipment.courierName = courier;
        }
        if (input.trackingNumber !== undefined && input.trackingNumber !== "") {
            const number = cleanText(input.trackingNumber);
            if (!number || number.length > MAX_TRACKING_NUMBER || !TRACKING_NUMBER_PATTERN.test(number)) {
                errors.trackingNumber = "Tracking number: letters, numbers and - . / only (up to 60).";
            }
            else
                shipment.trackingNumber = number;
        }
        if (input.trackingUrl !== undefined && input.trackingUrl !== "") {
            const raw = typeof input.trackingUrl === "string" ? input.trackingUrl.trim() : "";
            const url = parseTrackingUrl(raw);
            if (!url)
                errors.trackingUrl = "The tracking link must start with https://";
            else
                shipment.trackingUrl = url;
        }
        if (Object.keys(shipment).length > 0)
            value.shipment = shipment;
    }
    return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}
exports.parseVendorAction = parseVendorAction;
