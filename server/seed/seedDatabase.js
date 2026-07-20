require("dotenv").config();
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const { DB_USER, DB_PASS, DB_HOST, DB_NAME } = process.env;

const ProductSchema = new mongoose.Schema({
  _id: Number,
  description: String,
  actualPrice: Number,
  discountPrice: Number,
  rating: Number,
  imageUrl: [String],
});
const Products = mongoose.model("productData", ProductSchema);

const ServiceOptionSchema = new mongoose.Schema(
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

const ServiceCategorySchema = new mongoose.Schema(
  {
    id: String,
    label: String,
    icon: String,
    services: [ServiceOptionSchema],
  },
  { _id: false },
);

const VendorDetailSchema = new mongoose.Schema({
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
const VendorDetails = mongoose.model(
  "vendorDetails",
  VendorDetailSchema,
  "vendorDetails",
);

async function seed() {
  await mongoose.connect(
    `mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`,
  );
  console.log("Connected to MongoDB Atlas");

  const vendors = JSON.parse(
    fs.readFileSync(path.join(__dirname, "vendors.seed.json"), "utf-8"),
  );
  const vendorDetails = JSON.parse(
    fs.readFileSync(path.join(__dirname, "vendorDetails.seed.json"), "utf-8"),
  );

  for (const vendor of vendors) {
    await Products.updateOne(
      { _id: vendor._id },
      { $set: vendor },
      { upsert: true },
    );
  }
  console.log(`Seeded ${vendors.length} products into "productdatas"`);

  for (const detail of vendorDetails) {
    await VendorDetails.updateOne(
      { id: detail.id },
      { $set: detail },
      { upsert: true },
    );
  }
  console.log(`Seeded ${vendorDetails.length} vendor details into "vendorDetails"`);

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
