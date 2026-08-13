"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Users = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Schema = mongoose_1.default.Schema;
const AddressSchema = new Schema({
    contactName: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
}, { _id: false });
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
});
exports.Users = mongoose_1.default.model("users", UserSchema);
