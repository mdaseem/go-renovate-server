import mongoose, { connections } from "mongoose";
const Schema = mongoose.Schema;

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
  ]
});

export const Users = mongoose.model("users", UserSchema);
