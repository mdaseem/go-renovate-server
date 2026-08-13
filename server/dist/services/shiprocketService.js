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
exports.createAdhocOrder = exports.ShiprocketApiError = exports.ShiprocketNotConfiguredError = void 0;
const axios_1 = __importDefault(require("axios"));
const SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external";
const REQUEST_TIMEOUT_MS = 10000;
class ShiprocketNotConfiguredError extends Error {
    constructor() {
        super("Shiprocket credentials are not configured");
        this.name = "ShiprocketNotConfiguredError";
    }
}
exports.ShiprocketNotConfiguredError = ShiprocketNotConfiguredError;
class ShiprocketApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = "ShiprocketApiError";
        this.status = status;
    }
}
exports.ShiprocketApiError = ShiprocketApiError;
function toShiprocketApiError(error, context) {
    var _a, _b;
    if (axios_1.default.isAxiosError(error)) {
        const axiosError = error;
        const status = (_a = axiosError.response) === null || _a === void 0 ? void 0 : _a.status;
        const body = (_b = axiosError.response) === null || _b === void 0 ? void 0 : _b.data;
        console.error(`Shiprocket ${context} failed:`, status, body || axiosError.message);
        return new ShiprocketApiError((body === null || body === void 0 ? void 0 : body.message) || axiosError.message || `Shiprocket ${context} failed`, status);
    }
    console.error(`Shiprocket ${context} failed:`, error);
    return new ShiprocketApiError(`Shiprocket ${context} failed`);
}
let cachedToken = null;
function isConfigured() {
    return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}
function getToken(forceRefresh = false) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isConfigured()) {
            throw new ShiprocketNotConfiguredError();
        }
        if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
            return cachedToken.token;
        }
        try {
            const response = yield axios_1.default.post(`${SHIPROCKET_BASE_URL}/auth/login`, {
                email: process.env.SHIPROCKET_EMAIL,
                password: process.env.SHIPROCKET_PASSWORD,
            }, { timeout: REQUEST_TIMEOUT_MS });
            const token = response.data.token;
            // Shiprocket tokens are valid ~10 days; refresh a little early to be safe.
            cachedToken = { token, expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000 };
            return token;
        }
        catch (error) {
            cachedToken = null;
            throw toShiprocketApiError(error, "authentication");
        }
    });
}
// Renovation service line items don't have real parcel dimensions/weight —
// these nominal values only exist to satisfy Shiprocket's required schema
// for the adhoc-order payload.
const NOMINAL_WEIGHT_KG = 0.5;
const NOMINAL_DIMENSION_CM = 10;
function buildAdhocOrderPayload(order) {
    return {
        order_id: order.orderNumber,
        order_date: new Date().toISOString().slice(0, 19).replace("T", " "),
        pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION,
        billing_customer_name: order.address.contactName,
        billing_last_name: "",
        billing_address: order.address.line1,
        billing_address_2: order.address.line2 || "",
        billing_city: order.address.city,
        billing_state: order.address.state,
        billing_pincode: order.address.pincode,
        billing_country: "India",
        billing_phone: order.address.phone,
        shipping_is_billing: true,
        order_items: order.items.map((item) => ({
            name: item.name,
            sku: item.serviceId,
            units: item.quantity,
            selling_price: item.price,
        })),
        payment_method: "Prepaid",
        sub_total: order.total,
        length: NOMINAL_DIMENSION_CM,
        breadth: NOMINAL_DIMENSION_CM,
        height: NOMINAL_DIMENSION_CM,
        weight: NOMINAL_WEIGHT_KG,
    };
}
function postAdhocOrder(order, token) {
    return __awaiter(this, void 0, void 0, function* () {
        return axios_1.default.post(`${SHIPROCKET_BASE_URL}/orders/create/adhoc`, buildAdhocOrderPayload(order), { headers: { Authorization: `Bearer ${token}` }, timeout: REQUEST_TIMEOUT_MS });
    });
}
function createAdhocOrder(order) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const token = yield getToken();
        let response;
        try {
            response = yield postAdhocOrder(order, token);
        }
        catch (error) {
            // A cached token can go stale server-side (revoked/expired early) —
            // retry once with a fresh one before giving up.
            if (axios_1.default.isAxiosError(error) && ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 401) {
                const freshToken = yield getToken(true);
                try {
                    response = yield postAdhocOrder(order, freshToken);
                }
                catch (retryError) {
                    throw toShiprocketApiError(retryError, "order creation");
                }
            }
            else {
                throw toShiprocketApiError(error, "order creation");
            }
        }
        const data = response.data;
        return {
            shiprocketOrderId: String(data.order_id),
            shipmentId: String(data.shipment_id),
        };
    });
}
exports.createAdhocOrder = createAdhocOrder;
