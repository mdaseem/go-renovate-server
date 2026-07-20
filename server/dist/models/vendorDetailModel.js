"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorDetails = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Schema = mongoose_1.default.Schema;
const ServiceOptionSchema = new Schema({
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
}, { _id: false });
const ServiceCategorySchema = new Schema({
    id: String,
    label: String,
    icon: String,
    services: [ServiceOptionSchema],
}, { _id: false });
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
exports.VendorDetails = mongoose_1.default.model("vendorDetails", VendorDetailSchema, "vendorDetails");
