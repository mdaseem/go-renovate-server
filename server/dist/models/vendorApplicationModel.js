"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorApplications = exports.SELLS_OPTIONS = exports.APPLICATION_STATUSES = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Schema = mongoose_1.default.Schema;
exports.APPLICATION_STATUSES = ["pending", "approved", "rejected"];
exports.SELLS_OPTIONS = ["services", "products", "both"];
// One row per "Sell on Go Renovate" application. Approving it creates the vendor profile
// (vendorDetails) and links the applicant's account; see routes/vendorApplicationRoutes.ts.
const VendorApplicationSchema = new Schema({
    userId: { type: Number, required: true },
    userEmail: String,
    businessName: { type: String, required: true },
    city: { type: String, required: true },
    sells: { type: String, enum: exports.SELLS_OPTIONS, required: true },
    phone: { type: String, required: true },
    pickupAddress: { type: String, required: true },
    gstin: { type: String, default: "" },
    status: { type: String, enum: exports.APPLICATION_STATUSES, default: "pending" },
    rejectionReason: { type: String, default: "" },
    // Set when approved: the vendorDetails.id that was created for this applicant.
    vendorId: { type: String, default: null },
    decidedAt: Date,
    createdAt: { type: Date, default: Date.now },
});
VendorApplicationSchema.index({ userId: 1, createdAt: -1 });
VendorApplicationSchema.index({ status: 1, createdAt: 1 });
exports.VendorApplications = mongoose_1.default.model("vendorApplications", VendorApplicationSchema, "vendorApplications");
