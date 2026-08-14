import mongoose, { connections } from "mongoose";
const Schema = mongoose.Schema;

const AddressSchema = new Schema(
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

const RecentSearchSchema = new Schema(
  {
    term: String,
    searchedAt: Date,
  },
  { _id: false },
);

const UserSchema = new Schema({
  userName: String,
  userEmail: String,
  userPassword: String,
  userId: Number,
  connections: [
    {
      userId: Number,
      status: String,
    }
  ],
  address: AddressSchema,
  recentSearches: [RecentSearchSchema],
  wishlist: [String],
});

export const Users = mongoose.model("users", UserSchema);
