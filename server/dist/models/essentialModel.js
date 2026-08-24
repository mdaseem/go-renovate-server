"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Essentials = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Schema = mongoose_1.default.Schema;
const EssentialSchema = new Schema({
    name: { type: String, required: true },
    description: String,
    images: [String],
    price: { type: Number, required: true },
    discountPrice: Number,
    vendorId: { type: String, required: true },
    categorySlugs: [String],
    slot: { type: String, required: true },
    purchaseMode: {
        type: String,
        enum: ["on-platform", "external-store"],
        default: "on-platform",
    },
    externalStoreUrl: String,
});
// Supports GET /essentials query-param filtering (category, slot, vendorId, price range, purchaseMode)
EssentialSchema.index({ categorySlugs: 1 });
EssentialSchema.index({ slot: 1 });
EssentialSchema.index({ vendorId: 1 });
EssentialSchema.index({ price: 1 });
EssentialSchema.index({ purchaseMode: 1 });
exports.Essentials = mongoose_1.default.model("essential", EssentialSchema, "essentials");
