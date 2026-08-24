import mongoose from "mongoose";
const Schema = mongoose.Schema;

const CategorySlotSchema = new Schema(
  {
    id: String,
    label: String,
  },
  { _id: false },
);

const CategorySchema = new Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  icon: String,
  slots: [CategorySlotSchema],
  sortOrder: { type: Number, default: 0 },
});

export const Categories = mongoose.model(
  "category",
  CategorySchema,
  "categories",
);
