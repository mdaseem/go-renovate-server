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
const categoryModel_1 = require("../models/categoryModel");
const roomModel_1 = require("../models/roomModel");
const essentialModel_1 = require("../models/essentialModel");
const spaceModel_1 = require("../models/spaceModel");
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
        const categories = yield categoryModel_1.Categories.find().sort({ sortOrder: 1 });
        return res.json(categories);
    }
    catch (error) {
        console.error("Failed to fetch categories:", error);
        return res.status(500).json({ message: "Failed to fetch categories" });
    }
}));
router.get("/:slug", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { slug } = req.params;
        const category = yield categoryModel_1.Categories.findOne({ slug });
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        const { style, minPrice, maxPrice } = req.query;
        const roomFilter = { categorySlug: slug };
        const styles = parseMultiValue(style);
        if (styles) {
            roomFilter.styleTags = { $in: styles };
        }
        const min = typeof minPrice === "string" ? Number(minPrice) : NaN;
        const max = typeof maxPrice === "string" ? Number(maxPrice) : NaN;
        if (!Number.isNaN(min) || !Number.isNaN(max)) {
            const priceFilter = {};
            if (!Number.isNaN(min))
                priceFilter.$gte = min;
            if (!Number.isNaN(max))
                priceFilter.$lte = max;
            roomFilter.totalPrice = priceFilter;
        }
        const [rooms, essentials, spaces] = yield Promise.all([
            roomModel_1.Rooms.find(roomFilter),
            essentialModel_1.Essentials.find({ categorySlugs: slug }),
            // Selectable base layouts for the Customize preview, default first.
            spaceModel_1.Spaces.find({ categorySlug: slug }).sort({ isDefault: -1, sortOrder: 1 }),
        ]);
        const vendorNameById = yield (0, vendorNameLookup_1.getVendorNameMap)(essentials.map((essential) => essential.get("vendorId")));
        const essentialsBySlot = {};
        for (const essential of essentials) {
            const plain = essential.toObject();
            plain.vendorName =
                (_a = vendorNameById.get(plain.vendorId)) !== null && _a !== void 0 ? _a : "Unknown vendor";
            const slot = plain.slot;
            if (!essentialsBySlot[slot])
                essentialsBySlot[slot] = [];
            essentialsBySlot[slot].push(plain);
        }
        return res.json({ category, rooms, essentialsBySlot, spaces });
    }
    catch (error) {
        console.error("Failed to fetch category detail:", error);
        return res.status(500).json({ message: "Failed to fetch category detail" });
    }
}));
exports.default = router;
