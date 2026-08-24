import mongoose from "mongoose";
const Schema = mongoose.Schema;

const EssentialOrderItemSchema = new Schema(
  {
    essentialId: { type: Schema.Types.ObjectId, ref: "essential" },
    name: String,
    price: Number,
    quantity: Number,
    imageUrl: String,
  },
  { _id: false },
);

const EssentialOrderAddressSchema = new Schema(
  {
    contactName: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
  },
  { _id: false },
);

const EssentialOrderStatusHistorySchema = new Schema(
  {
    status: { type: String, required: true },
    note: String,
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ShiprocketInfoSchema = new Schema(
  {
    orderId: String,
    shipmentId: String,
    awbCode: String,
    courierName: String,
    trackingUrl: String,
    status: String,
  },
  { _id: false },
);

// One sub-order per vendor within a single checkout — each progresses
// through the same OrderStatus state machine as orderModel.ts's Orders
// (reused, not duplicated), independently, since each ships separately.
// Vendor-approval/status-transition endpoints (mirroring orderRoutes.ts's
// PATCH /:id/status) are deliberately not built yet — see the
// room-based-discovery skill's Ordered implementation list.
const VendorOrderSchema = new Schema(
  {
    vendorId: { type: String, required: true },
    vendorName: String,
    items: [EssentialOrderItemSchema],
    subtotal: Number,
    status: { type: String, required: true, default: "PLACED" },
    statusHistory: [EssentialOrderStatusHistorySchema],
    shiprocket: { type: ShiprocketInfoSchema, default: null },
  },
  { _id: true },
);

const EssentialOrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },

    userId: Number,
    userEmail: { type: String, required: true },
    userName: String,

    address: EssentialOrderAddressSchema,
    total: Number,

    vendorOrders: [VendorOrderSchema],
  },
  { timestamps: true },
);

EssentialOrderSchema.index({ userEmail: 1 });

export const EssentialOrders = mongoose.model(
  "essentialOrder",
  EssentialOrderSchema,
  "essentialOrders",
);
