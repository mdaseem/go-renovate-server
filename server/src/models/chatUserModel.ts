import mongoose from "mongoose";
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  Name: String,
  status: String,
  id: String,
});

export const ChatUsers = mongoose.model("chatusers", UserSchema);
