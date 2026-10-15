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
  // What the account may do (see services/roles.ts). Accounts created before roles existed have no
  // value and count as customers; admins are decided by the ADMIN_EMAILS env var, not stored here.
  // Only the server ever sets these - never copy them from a request body.
  role: { type: String, enum: ["customer", "vendor"], default: "customer" },
  // The vendorDetails.id this account manages (set when an admin links them); null for everyone else.
  vendorId: { type: String, default: null },
});

export const Users = mongoose.model("users", UserSchema);
