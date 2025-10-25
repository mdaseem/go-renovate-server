"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const userModels_1 = require("../models/userModels");
const router = express_1.default.Router();
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = req.body.data;
    const allUsers = yield userModels_1.Users.find({});
    const validUserData = allUsers === null || allUsers === void 0 ? void 0 : allUsers.find((item) => (item === null || item === void 0 ? void 0 : item.userEmail) === (data === null || data === void 0 ? void 0 : data.userEmail));
    if (validUserData) {
        let payload = { name: data, lastLogin: "Monday 25th" };
        jsonwebtoken_1.default.sign(payload, process.env.SECRET_KEY || "OtherSecretKey", { expiresIn: "2 Days" }, (err, token) => {
            if (err)
                console.log(err);
            else
                return res.json({ token, status: true, validUserData });
        });
    }
    else {
        res.json({ message: "Invalid user", status: false });
    }
}));
exports.default = router;
