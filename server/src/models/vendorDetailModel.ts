import mongoose from "mongoose";
const Schema = mongoose.Schema;

const ServiceOptionSchema = new Schema(
  {
    id: String,
    name: String,
    description: String,
    price: Number,
    unit: String,
    materialTag: String,
    estimatedDays: Number,
    popular: Boolean,
    imageUrl: String,
    images: [String],
    includes: [String],
    isAvailable: { type: Boolean, default: true },
  },
  { _id: false },
);

const ServiceCategorySchema = new Schema(
  {
    id: String,
    label: String,
    icon: String,
    services: [ServiceOptionSchema],
  },
  { _id: false },
);

const VendorDetailSchema = new Schema({
  id: String,
  name: String,
  tagline: String,
  rating: Number,
  reviewCount: Number,
  completedProjects: Number,
  yearsActive: Number,
  location: String,
  responseTime: String,
  verified: Boolean,
  badges: [String],
  categories: [ServiceCategorySchema],
  // Whether the profile is shown publicly. A missing value counts as "active" (profiles created
  // before sign-up existed), so never default it here - see services/vendorVisibility.ts.
  status: { type: String, enum: ["pending", "active", "paused"] },
  // "seed" = demo data from the seed files; "application" = a real vendor approved through sign-up.
  source: { type: String, enum: ["seed", "application"] },
  // Users.userId of the account that manages this profile (null = nobody can log in to it).
  ownerUserId: { type: Number, default: null },
  approvedAt: Date,
});

// Supports GET /vendors query-param filtering (category, location, rating, verified)
VendorDetailSchema.index({ "categories.id": 1 });
VendorDetailSchema.index({ location: 1 });
VendorDetailSchema.index({ rating: 1 });
VendorDetailSchema.index({ verified: 1 });
VendorDetailSchema.index({ ownerUserId: 1 });

export const VendorDetails = mongoose.model(
  "vendorDetails",
  VendorDetailSchema,
  "vendorDetails",
);
