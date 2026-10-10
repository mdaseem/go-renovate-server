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
// LEGACY single-scene settings for this category's room preview. Superseded by
// the selectable `spaces` collection (models/spaceModel.ts); kept only as the
// fallback for categories that have no spaces seeded yet.
const SceneSchema = new Schema({
    backdrop: String,
    sceneWidthCm: Number,
    floorLine: Number, // 0–1: where the wall meets the floor, from the top
}, { _id: false });
const CategorySchema = new Schema({
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    icon: String,
    slots: [CategorySlotSchema],
    scene: SceneSchema,
    sortOrder: { type: Number, default: 0 },
});
exports.Categories = mongoose_1.default.model("category", CategorySchema, "categories");
