import mongoose from "mongoose";
import { formatIssues, validateDimensions } from "../services/dimensionRules";
const Schema = mongoose.Schema;

// Visual-preview data (see the room-visual-preview skill). All optional: a
// product without them still works everywhere; the scene just falls back to a
// labelled tile at a default size.
const DimensionsSchema = new Schema(
  { w: Number, h: Number, d: Number }, // centimetres
  { _id: false },
);
// An optional 3D model of the product (a .glb file) for the in-house viewer. The
// url is either a path on the frontend (placeholders in /public) or an https URL.
// Only the file kind is checked here; the viewer itself re-validates the file.
const Model3dSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
      match: [/^(\/(?!\/)|https:\/\/)[^\s?]+\.glb(\?\S*)?$/i, "model3d.url must be a .glb path or https URL"],
    },
    sizeBytes: { type: Number, min: 0 },
    triangles: { type: Number, min: 0 },
    // The model's own measured bounding box in cm (the viewer lab reports it);
    // compared with dimensionsCm on save - see services/dimensionRules.ts.
    sizeCm: { type: DimensionsSchema },
    // Provenance: where the file came from, so a stand-in is never mistaken for the real product.
    source: { type: String, enum: ["vendor", "commissioned", "scanned", "test-placeholder"] },
    credit: { type: String, maxlength: 120 },
    licence: { type: String, maxlength: 120 },
    checkedAt: Date,
  },
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
  model3d: Model3dSchema,
  // Vendor-created products (routes/vendorProductRoutes.ts): see services/productVisibility.ts. No schema
  // default on `status` on purpose: a missing status means live, which keeps every seeded product public.
  status: { type: String, enum: ["pending", "live", "paused", "rejected"] },
  // "vendor" = created by a vendor through the product screens; missing = seeded or entered by the owner.
  source: { type: String, enum: ["vendor"] },
  // Who paused it: a vendor may resume their own pause, but never one made by the owner.
  pausedBy: { type: String, enum: ["vendor", "admin"] },
  submittedAt: Date,
  approvedAt: Date,
  reviewedAt: Date,
  // The owner's reason when a product is rejected (shown to the vendor).
  reviewNote: String,
});

// Supports GET /essentials query-param filtering (category, slot, vendorId, price range, purchaseMode)
EssentialSchema.index({ categorySlugs: 1 });
EssentialSchema.index({ slot: 1 });
EssentialSchema.index({ vendorId: 1 });
EssentialSchema.index({ price: 1 });
EssentialSchema.index({ purchaseMode: 1 });
EssentialSchema.index({ vendorId: 1, status: 1 });
EssentialSchema.index({ source: 1, status: 1 });

// A product whose size cannot be drawn honestly (a cutout with no width/height,
// a negative number…) is rejected on save/create. Merely unusual sizes are only
// warnings — see services/dimensionRules.ts and `npm run check:dimensions`.
EssentialSchema.pre("validate", function (next) {
  const dims = this.get("dimensionsCm");
  const { errors } = validateDimensions({
    slot: this.get("slot"),
    cutoutUrl: this.get("cutoutUrl"),
    dimensionsCm: dims ? { w: dims.w, h: dims.h, d: dims.d } : null,
    placement: this.get("placement"),
    model3d: this.get("model3d"),
  });
  if (errors.length > 0) this.invalidate("dimensionsCm", formatIssues(errors));
  next();
});

export const Essentials = mongoose.model(
  "essential",
  EssentialSchema,
  "essentials",
);
