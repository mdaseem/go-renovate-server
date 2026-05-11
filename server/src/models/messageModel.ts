// models/Message.js

import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
    },

    senderId: {
      type: String,
      required: true,
    },
    sender: {
      type: String,
      required: true,
    },

    receiverId: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model("message", messageSchema);

export default Message;