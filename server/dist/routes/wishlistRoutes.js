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
const vendorDetailModel_1 = require("../models/vendorDetailModel");
const router = express_1.default.Router();
// requireAuth sets req.user = decoded, and the token is signed as
// { name: userFound } (see authorizeUser.ts / orderRoutes.ts), so the
// actual user fields live one level down at req.user.name.
function getAuthedUserId(req) {
    var _a;
    const decoded = req.user;
    return (_a = decoded === null || decoded === void 0 ? void 0 : decoded.name) === null || _a === void 0 ? void 0 : _a.userId;
}
function requireAuthedUserId(req, res) {
    const userId = getAuthedUserId(req);
    if (typeof userId !== "number") {
        res.status(401).json({ message: "Invalid session" });
        return undefined;
    }
    return userId;
}
// $in doesn't preserve the order of the ids passed to it, so hydrated
// results are re-sorted to match wishlist order — most recently added
// (last pushed by $addToSet) shown first.
function hydrateWishlist(wishlist) {
    return __awaiter(this, void 0, void 0, function* () {
        const vendors = yield vendorDetailModel_1.VendorDetails.find({ id: { $in: wishlist } });
        const order = new Map(wishlist.map((id, index) => [id, index]));
        return vendors.sort((a, b) => {
            var _a, _b;
            return ((_a = order.get(b.get("id"))) !== null && _a !== void 0 ? _a : 0) -
                ((_b = order.get(a.get("id"))) !== null && _b !== void 0 ? _b : 0);
        });
    });
}
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = requireAuthedUserId(req, res);
        if (userId === undefined)
            return;
        const user = yield userModels_1.Users.findOne({ userId });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const vendors = yield hydrateWishlist(user.wishlist || []);
        return res.json(vendors);
    }
    catch (error) {
        console.error("Failed to fetch wishlist:", error);
        return res.status(500).json({ message: "Failed to fetch wishlist" });
    }
}));
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = requireAuthedUserId(req, res);
        if (userId === undefined)
            return;
        const vendorId = typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.vendorId) === "string" ? req.body.vendorId.trim() : "";
        if (!vendorId) {
            return res.status(400).json({ message: "vendorId is required" });
        }
        const vendor = yield vendorDetailModel_1.VendorDetails.findOne({ id: vendorId });
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }
        const user = yield userModels_1.Users.findOneAndUpdate({ userId }, { $addToSet: { wishlist: vendorId } }, { new: true });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const vendors = yield hydrateWishlist(user.wishlist || []);
        return res.json(vendors);
    }
    catch (error) {
        console.error("Failed to add to wishlist:", error);
        return res.status(500).json({ message: "Failed to add to wishlist" });
    }
}));
router.delete("/:vendorId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = requireAuthedUserId(req, res);
        if (userId === undefined)
            return;
        const { vendorId } = req.params;
        const user = yield userModels_1.Users.findOneAndUpdate({ userId }, { $pull: { wishlist: vendorId } }, { new: true });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const vendors = yield hydrateWishlist(user.wishlist || []);
        return res.json(vendors);
    }
    catch (error) {
        console.error("Failed to remove from wishlist:", error);
        return res.status(500).json({ message: "Failed to remove from wishlist" });
    }
}));
exports.default = router;
