import mongoose from "mongoose";
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  userName: String,
  userEmail: String,
  userPassword: String,
  userId: Number
});

export const Users = mongoose.model("users", UserSchema);
