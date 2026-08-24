import mongoose from "mongoose";
const Schema = mongoose.Schema;

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

export const Essentials = mongoose.model(
  "essential",
  EssentialSchema,
  "essentials",
);
