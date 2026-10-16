import mongoose from "mongoose";
const Schema = mongoose.Schema;

export const APPLICATION_STATUSES = ["pending", "approved", "rejected"] as const;
export const SELLS_OPTIONS = ["services", "products", "both"] as const;

// One row per "Sell on Go Renovate" application. Approving it creates the vendor profile
// (vendorDetails) and links the applicant's account; see routes/vendorApplicationRoutes.ts.
const VendorApplicationSchema = new Schema({
  userId: { type: Number, required: true },
  userEmail: String,
  businessName: { type: String, required: true },
  city: { type: String, required: true },
  sells: { type: String, enum: SELLS_OPTIONS, required: true },
  phone: { type: String, required: true },
  pickupAddress: { type: String, required: true },
  gstin: { type: String, default: "" },
  status: { type: String, enum: APPLICATION_STATUSES, default: "pending" },
  rejectionReason: { type: String, default: "" },
  // Set when approved: the vendorDetails.id that was created for this applicant.
  vendorId: { type: String, default: null },
  decidedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

VendorApplicationSchema.index({ userId: 1, createdAt: -1 });
VendorApplicationSchema.index({ status: 1, createdAt: 1 });

export const VendorApplications = mongoose.model(
  "vendorApplications",
  VendorApplicationSchema,
  "vendorApplications",
);
