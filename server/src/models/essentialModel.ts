import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Visual-preview data (see the room-visual-preview skill). All optional: a
// product without them still works everywhere; the scene just falls back to a
// labelled tile at a default size.
const DimensionsSchema = new Schema(
  { w: Number, h: Number, d: Number }, // centimetres
  { _id: false },
);
const PlacementSchema = new Schema(
  {
    // "surface" = rests ON another piece (a plant on a table, a vase on a shelf).
    zone: {
      type: String,
      enum: ["floor", "wall", "ceiling", "surface"],
      default: "floor",
    },
    // Paint order within a zone. Lower sits further back (e.g. a rug = 0).
    layer: { type: Number, default: 1 },
    // WALL pieces only: height of the piece's CENTRE above the floor, in cm
    // (frames/mirrors ~150, lights ~170, shelves ~120). The preview hangs the
    // piece there by default and lets the user move it up and down the wall.
    elevationCm: { type: Number, min: 0, max: 600 },
    // True on floor/wall pieces that can hold surface pieces (tables, consoles,
    // wall shelves). The resting surface is the piece's top edge.
    supports: Boolean,
  },
  { _id: false },
);

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
  // Units available for on-platform purchase. Left unset on purpose = "not
  // tracked" (treated as in stock), so existing documents keep working with
  // no migration. external-store items ignore it — the vendor's own store
  // owns that inventory.
  stock: { type: Number, min: 0 },
  // Transparent, tightly-cropped, front-view image supplied by the vendor.
  cutoutUrl: String,
  dimensionsCm: DimensionsSchema,
  placement: PlacementSchema,
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
