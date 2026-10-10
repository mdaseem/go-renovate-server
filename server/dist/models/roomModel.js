"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rooms = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Schema = mongoose_1.default.Schema;
// Not unique-indexed on categorySlug so a Category can have multiple Rooms
// (curated bundles) — the admin curation screen to create more than the
// single seeded Room per category doesn't exist yet, but the schema
// shouldn't block it.
const RoomSchema = new Schema({
    categorySlug: { type: String, required: true },
    title: { type: String, required: true },
    essentialIds: [{ type: Schema.Types.ObjectId, ref: "essential" }],
    heroImageUrl: String,
    // Denormalized sum of essentialIds' prices, recomputed whenever a Room is
    // curated/edited (no admin screen yet, so recomputed in the seed script
    // for now) — avoids an aggregation query on every filter/list request.
    totalPrice: { type: Number, default: 0 },
    styleTags: [String],
    // The Space (base layout, see models/spaceModel.ts) this curated Room is shown
    // in — in Browse All previews and the Room-detail overlay. Optional: a Room
    // without one (or with an unknown slug) uses its category's default space.
    spaceSlug: String,
});
RoomSchema.index({ categorySlug: 1 });
RoomSchema.index({ styleTags: 1 });
RoomSchema.index({ totalPrice: 1 });
exports.Rooms = mongoose_1.default.model("room", RoomSchema, "rooms");
