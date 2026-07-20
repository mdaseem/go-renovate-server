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
const vendorDetailModel_1 = require("../models/vendorDetailModel");
const router = express_1.default.Router();
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vendors = yield vendorDetailModel_1.VendorDetails.find({});
        return res.json(vendors);
    }
    catch (error) {
        console.error("Failed to fetch vendors:", error);
        return res.status(500).json({ message: "Failed to fetch vendors" });
    }
}));
router.get("/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const vendor = yield vendorDetailModel_1.VendorDetails.findOne({ id });
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }
        return res.json(vendor);
    }
    catch (error) {
        console.error("Failed to fetch vendor detail:", error);
        return res.status(500).json({ message: "Failed to fetch vendor detail" });
    }
}));
exports.default = router;
