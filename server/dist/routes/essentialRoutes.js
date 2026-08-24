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
const mongoose_1 = __importDefault(require("mongoose"));
const essentialModel_1 = require("../models/essentialModel");
const vendorNameLookup_1 = require("../services/vendorNameLookup");
const router = express_1.default.Router();
function parseMultiValue(value) {
    if (typeof value !== "string" || value.length === 0)
        return undefined;
    const values = value.split("|").filter(Boolean);
    return values.length > 0 ? values : undefined;
}
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { category, slot, vendorId, minPrice, maxPrice, purchaseMode } = req.query;
        const filter = {};
        if (typeof category === "string" && category.length > 0) {
            filter.categorySlugs = category;
        }
        const slots = parseMultiValue(slot);
        if (slots) {
            filter.slot = { $in: slots };
        }
        const vendorIds = parseMultiValue(vendorId);
        if (vendorIds) {
            filter.vendorId = { $in: vendorIds };
        }
        const min = typeof minPrice === "string" ? Number(minPrice) : NaN;
        const max = typeof maxPrice === "string" ? Number(maxPrice) : NaN;
        if (!Number.isNaN(min) || !Number.isNaN(max)) {
            filter.price = {};
            if (!Number.isNaN(min))
                filter.price.$gte = min;
            if (!Number.isNaN(max))
                filter.price.$lte = max;
        }
        if (purchaseMode === "on-platform" || purchaseMode === "external-store") {
            filter.purchaseMode = purchaseMode;
        }
        const essentials = yield essentialModel_1.Essentials.find(filter);
        const vendorNameById = yield (0, vendorNameLookup_1.getVendorNameMap)(essentials.map((essential) => essential.get("vendorId")));
        const enriched = essentials.map((essential) => {
            var _a;
            const plain = essential.toObject();
            plain.vendorName =
                (_a = vendorNameById.get(plain.vendorId)) !== null && _a !== void 0 ? _a : "Unknown vendor";
            return plain;
        });
        return res.json(enriched);
    }
    catch (error) {
        console.error("Failed to fetch essentials:", error);
        return res.status(500).json({ message: "Failed to fetch essentials" });
    }
}));
router.get("/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!mongoose_1.default.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid essential id" });
        }
        const essential = yield essentialModel_1.Essentials.findById(req.params.id);
        if (!essential) {
            return res.status(404).json({ message: "Essential not found" });
        }
        return res.json(essential);
    }
    catch (error) {
        console.error("Failed to fetch essential:", error);
        return res.status(500).json({ message: "Failed to fetch essential" });
    }
}));
exports.default = router;
