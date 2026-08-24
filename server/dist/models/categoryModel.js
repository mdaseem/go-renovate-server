"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Categories = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Schema = mongoose_1.default.Schema;
const CategorySlotSchema = new Schema({
    id: String,
    label: String,
}, { _id: false });
const CategorySchema = new Schema({
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    icon: String,
    slots: [CategorySlotSchema],
    sortOrder: { type: Number, default: 0 },
});
exports.Categories = mongoose_1.default.model("category", CategorySchema, "categories");
