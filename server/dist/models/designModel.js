"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Designs = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Schema = mongoose_1.default.Schema;
// A saved Customize design, shared by link. Anyone can create one (no login) —
// the id is a random 10-character token, and a design only stores presentation
// data: which products, where they sit, and the room's size/colours. Prices and
// stock are always read live, never from here. Designs expire after a year.
const DesignSchema = new Schema({
    shortId: { type: String, required: true, unique: true },
    categorySlug: { type: String, required: true },
    // The space (base layout) the arrangement was made in; null = the category default.
    spaceSlug: { type: String, default: null },
    // Ordered, repeats allowed (a repeat is a second copy of the same product).
    essentialIds: [{ type: Schema.Types.ObjectId, ref: "essential" }],
    // pieceKey ("<essentialId>#<copy>") -> transform; see the frontend's ScenePosition.
    positions: { type: Schema.Types.Mixed, default: {} },
    roomWidthCm: { type: Number, default: null },
    roomHeightCm: { type: Number, default: null },
    wallId: { type: String, default: null },
    floorId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 365 },
});
exports.Designs = mongoose_1.default.model("design", DesignSchema, "designs");
