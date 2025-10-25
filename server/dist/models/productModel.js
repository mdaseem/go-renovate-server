"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Products = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Schema = mongoose_1.default.Schema;
const productSchema = new Schema({
    description: String,
    actualPrice: Number,
    discountPrice: Number,
    rating: Number,
    imageUrl: String,
});
exports.Products = mongoose_1.default.model("productData", productSchema);
