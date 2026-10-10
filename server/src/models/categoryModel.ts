import mongoose from "mongoose";
const Schema = mongoose.Schema;

const CategorySlotSchema = new Schema(
  {
    id: String,
    label: String,
  },
  { _id: false },
);

// LEGACY single-scene settings for this category's room preview. Superseded by
// the selectable `spaces` collection (models/spaceModel.ts); kept only as the
// fallback for categories that have no spaces seeded yet.
const SceneSchema = new Schema(
  {
    backdrop: String, // key of an inline-SVG backdrop on the frontend
    sceneWidthCm: Number, // real-world width the scene's full width represents
    floorLine: Number, // 0–1: where the wall meets the floor, from the top
  },
  { _id: false },
);

const CategorySchema = new Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  icon: String,
  slots: [CategorySlotSchema],
  scene: SceneSchema,
  sortOrder: { type: Number, default: 0 },
});

export const Categories = mongoose.model(
  "category",
  CategorySchema,
  "categories",
);
