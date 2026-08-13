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
    try {
        const data = req.body;
        if (!(data === null || data === void 0 ? void 0 : data.isGoogleLogin) && (!(data === null || data === void 0 ? void 0 : data.email) || !(data === null || data === void 0 ? void 0 : data.password))) {
            return res.json({ message: "Email and password are required", status: false });
        }
        if ((data === null || data === void 0 ? void 0 : data.isGoogleLogin) && !(data === null || data === void 0 ? void 0 : data.userEmail)) {
            return res.json({ message: "userEmail is required", status: false });
        }
        const allUsers = yield userModels_1.Users.find({});
        // Google login sends `userEmail` (not `email`) and no password — look the
        // user up by that instead, and provision a Users document on first
        // Google sign-in since there's currently no other path that creates one
        // for them.
        let userFound = data.isGoogleLogin
            ? allUsers === null || allUsers === void 0 ? void 0 : allUsers.find((item) => (item === null || item === void 0 ? void 0 : item.userEmail) === (data === null || data === void 0 ? void 0 : data.userEmail))
            : allUsers === null || allUsers === void 0 ? void 0 : allUsers.find((item) => (item === null || item === void 0 ? void 0 : item.userEmail) === (data === null || data === void 0 ? void 0 : data.email) &&
                (item === null || item === void 0 ? void 0 : item.userPassword) === (data === null || data === void 0 ? void 0 : data.password));
        if (data.isGoogleLogin && !userFound) {
            userFound = yield userModels_1.Users.create({
                userEmail: data.userEmail,
                userName: data.userName || data.userEmail,
                userId: Date.now(),
                connections: [],
            });
        }
        if ((data === null || data === void 0 ? void 0 : data.password) && !userFound) {
            return res.json({ message: "Invalid password", status: false });
        }
        if (!userFound) {
            return res.json({ message: "Invalid user", status: false });
        }
        const payload = { name: userFound };
        jsonwebtoken_1.default.sign(payload, "any_random_string_generated_once", { expiresIn: "2 Days" }, (err, token) => {
            if (err || !token) {
                console.error("Failed to sign JWT:", err);
                return res.status(500).json({ message: "Login failed", status: false });
            }
            return res.json({
                token,
                status: true,
                user: {
                    name: userFound === null || userFound === void 0 ? void 0 : userFound.userName,
                    email: userFound === null || userFound === void 0 ? void 0 : userFound.userEmail,
                    id: userFound === null || userFound === void 0 ? void 0 : userFound.userId,
                    connections: userFound === null || userFound === void 0 ? void 0 : userFound.connections,
                },
            });
        });
    }
    catch (error) {
        console.error("Login failed:", error);
        return res.status(500).json({ message: "Login failed", status: false });
    }
}));
exports.default = router;
