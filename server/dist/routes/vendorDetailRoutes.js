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
const MAX_SEARCH_LENGTH = 100;
const MAX_AVAILABILITY_IDS = 50;
function parseMultiValue(value) {
    if (typeof value !== "string" || value.length === 0)
        return undefined;
    const values = value.split("|").filter(Boolean);
    return values.length > 0 ? values : undefined;
}
// Escapes regex metacharacters in free-text search input before it's used
// to build a RegExp, so a query like "A/C (window)" can't throw or be
// (ab)used to build an unintended pattern.
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function relevanceScore(vendor, term) {
    const name = (vendor.name || "").toLowerCase();
    if (name === term)
        return 3;
    if (name.startsWith(term))
        return 2;
    if (name.includes(term))
        return 1;
    return 0;
}
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { category, location, rating, verified, search, limit } = req.query;
        const filter = {};
        const categoryIds = parseMultiValue(category);
        if (categoryIds) {
            filter["categories.id"] = { $in: categoryIds };
        }
        const locations = parseMultiValue(location);
        if (locations) {
            filter.location = { $in: locations };
        }
        if (typeof rating === "string" && rating.length > 0) {
            const minRating = Number(rating);
            if (!Number.isNaN(minRating)) {
                filter.rating = { $gte: minRating };
            }
        }
        if (verified === "1") {
            filter.verified = true;
        }
        const searchTerm = typeof search === "string" ? search.trim().slice(0, MAX_SEARCH_LENGTH) : "";
        if (searchTerm) {
            const pattern = new RegExp(escapeRegExp(searchTerm), "i");
            filter.$or = [
                { name: pattern },
                { tagline: pattern },
                { location: pattern },
                { "categories.label": pattern },
                { "categories.services.name": pattern },
            ];
        }
        let vendors = yield vendorDetailModel_1.VendorDetails.find(filter);
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            vendors = vendors
                .slice()
                .sort((a, b) => relevanceScore(b, lowerTerm) - relevanceScore(a, lowerTerm) ||
                (b.rating || 0) - (a.rating || 0));
        }
        const limitNum = typeof limit === "string" ? Number(limit) : NaN;
        if (!Number.isNaN(limitNum) && limitNum > 0) {
            vendors = vendors.slice(0, limitNum);
        }
        return res.json(vendors);
    }
    catch (error) {
        console.error("Failed to fetch vendors:", error);
        return res.status(500).json({ message: "Failed to fetch vendors" });
    }
}));
router.get("/:id/services/availability", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const idsParam = req.query.ids;
        const requestedIds = typeof idsParam === "string"
            ? idsParam.split(",").map((value) => value.trim()).filter(Boolean)
            : [];
        if (requestedIds.length === 0) {
            return res.status(400).json({ message: "ids query parameter is required" });
        }
        if (requestedIds.length > MAX_AVAILABILITY_IDS) {
            return res.status(400).json({
                message: `At most ${MAX_AVAILABILITY_IDS} ids can be checked at once`,
            });
        }
        const vendor = yield vendorDetailModel_1.VendorDetails.findOne({ id }, { categories: 1 });
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }
        const catalog = new Map();
        const categories = vendor.get("categories") || [];
        for (const category of categories) {
            for (const service of category.services || []) {
                catalog.set(service.id, {
                    price: typeof service.price === "number" ? service.price : null,
                    isAvailable: service.isAvailable !== false,
                });
            }
        }
        const services = requestedIds.map((serviceId) => {
            const entry = catalog.get(serviceId);
            return {
                id: serviceId,
                isAvailable: entry ? entry.isAvailable : false,
                price: entry ? entry.price : null,
            };
        });
        return res.json({ services });
    }
    catch (error) {
        console.error("Failed to check service availability:", error);
        return res.status(500).json({ message: "Failed to check service availability" });
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
