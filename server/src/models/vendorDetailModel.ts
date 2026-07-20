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
    includes: [String],
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
});

export const VendorDetails = mongoose.model(
  "vendorDetails",
  VendorDetailSchema,
  "vendorDetails",
);
