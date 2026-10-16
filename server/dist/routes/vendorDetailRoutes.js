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
const vendorVisibility_1 = require("../services/vendorVisibility");
const featureFlags_1 = require("../services/featureFlags");
const shopCatalogue_1 = require("../services/shopCatalogue");
const textSafety_1 = require("../services/textSafety");
const router = express_1.default.Router();
const MAX_SEARCH_LENGTH = 100;
const MAX_AVAILABILITY_IDS = 50;
// Internal fields that the public pages never need (the owner is a user account id).
const PUBLIC_PROJECTION = { ownerUserId: 0 };
function parseMultiValue(value) {
    if (typeof value !== "string" || value.length === 0)
        return undefined;
    const values = value.split("|").filter(Boolean);
    return values.length > 0 ? values : undefined;
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
// In shop mode (the default) `categories` in every response below are the vendor's product
// categories and their `services` are products - see services/shopCatalogue.ts.
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { category, location, rating, verified, search, limit } = req.query;
        const shopMode = !(0, featureFlags_1.servicesEnabled)();
        const filter = Object.assign({}, (yield (0, vendorVisibility_1.getPublicVendorFilter)()));
        const andConditions = [];
        const categoryIds = parseMultiValue(category);
        if (categoryIds) {
            if (shopMode) {
                andConditions.push({ id: { $in: yield (0, shopCatalogue_1.vendorIdsWithSlots)(categoryIds) } });
            }
            else {
                filter["categories.id"] = { $in: categoryIds };
            }
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
            const pattern = new RegExp((0, textSafety_1.escapeRegExp)(searchTerm), "i");
            const matches = [
                { name: pattern },
                { tagline: pattern },
                { location: pattern },
            ];
            if (shopMode) {
                matches.push({ id: { $in: yield (0, shopCatalogue_1.vendorIdsMatchingProducts)(pattern) } });
            }
            else {
                matches.push({ "categories.label": pattern }, { "categories.services.name": pattern });
            }
            filter.$or = matches;
        }
        if (andConditions.length > 0) {
            filter.$and = andConditions;
        }
        let vendors = yield vendorDetailModel_1.VendorDetails.find(filter, PUBLIC_PROJECTION);
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
        return res.json(yield (0, shopCatalogue_1.presentVendors)(vendors));
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
        const vendor = yield vendorDetailModel_1.VendorDetails.findOne(yield (0, vendorVisibility_1.publicVendorQuery)({ id }), { categories: 1 });
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
        const vendor = yield vendorDetailModel_1.VendorDetails.findOne(yield (0, vendorVisibility_1.publicVendorQuery)({ id }), PUBLIC_PROJECTION);
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }
        const [presented] = yield (0, shopCatalogue_1.presentVendors)([vendor]);
        return res.json(presented);
    }
    catch (error) {
        console.error("Failed to fetch vendor detail:", error);
        return res.status(500).json({ message: "Failed to fetch vendor detail" });
    }
}));
exports.default = router;
