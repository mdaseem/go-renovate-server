"use strict";
// models/Message.js
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const messageSchema = new mongoose_1.default.Schema({
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
}, {
    timestamps: true,
});
const Message = mongoose_1.default.model("message", messageSchema);
exports.default = Message;
