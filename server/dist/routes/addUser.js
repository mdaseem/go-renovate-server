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
const userModels_1 = require("../models/userModels");
const passwords_1 = require("../services/passwords");
const roles_1 = require("../services/roles");
const router = express_1.default.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 100;
function text(value, max) {
    return typeof value === "string" && value.length <= max ? value.trim() : "";
}
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const body = (_a = req.body) !== null && _a !== void 0 ? _a : {};
        const legacy = body.data && typeof body.data === "object" ? body.data : null;
        const email = text(legacy ? legacy.userEmail : body.email, MAX_EMAIL_LENGTH);
        const password = legacy ? legacy.userPassword : body.password;
        const requestedName = text(legacy ? legacy.userName : body.name, MAX_NAME_LENGTH);
        if (!EMAIL_PATTERN.test(email)) {
            return res.status(400).json({ message: "Please enter a valid email address" });
        }
        if (typeof password !== "string" ||
            password.length < passwords_1.MIN_PASSWORD_LENGTH ||
            password.length > passwords_1.MAX_PASSWORD_LENGTH) {
            return res.status(400).json({
                message: `Password must be ${passwords_1.MIN_PASSWORD_LENGTH}-${passwords_1.MAX_PASSWORD_LENGTH} characters`,
            });
        }
        // An admin email is only ever usable through a verified Google sign-in. Password accounts are not
        // email-verified, so letting anyone register it would let them become admin.
        if ((0, roles_1.isReservedAdminEmail)(email)) {
            return res
                .status(409)
                .json({ message: "An account with this email already exists" });
        }
        const existing = yield userModels_1.Users.findOne({
            userEmail: { $in: [email, email.toLowerCase()] },
        });
        if (existing) {
            return res
                .status(409)
                .json({ message: "An account with this email already exists" });
        }
        const normalizedEmail = email.toLowerCase();
        yield userModels_1.Users.create({
            userEmail: normalizedEmail,
            userPassword: yield (0, passwords_1.hashPassword)(password),
            userName: requestedName || normalizedEmail.split("@")[0],
            userId: Date.now(),
            connections: [],
        });
        return res.json({
            msg: "User added successfully !",
            status: true,
            newUser: normalizedEmail,
        });
    }
    catch (error) {
        console.error("Signup failed:", error);
        return res.status(500).json({ message: "Signup failed. Please try again." });
    }
}));
exports.default = router;
