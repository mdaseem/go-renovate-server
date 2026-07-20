import mongoose from "mongoose";
const Schema = mongoose.Schema;

const productSchema = new Schema({
  _id: Number,
  description: String,
  actualPrice: Number,
  discountPrice: Number,
  rating: Number,
  imageUrl: [String],
});

export const Products = mongoose.model("productData", productSchema);
