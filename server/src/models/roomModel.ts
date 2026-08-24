import mongoose from "mongoose";
const Schema = mongoose.Schema;

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
});

RoomSchema.index({ categorySlug: 1 });
RoomSchema.index({ styleTags: 1 });
RoomSchema.index({ totalPrice: 1 });

export const Rooms = mongoose.model("room", RoomSchema, "rooms");
