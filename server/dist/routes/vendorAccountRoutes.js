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
const authMiddleware_1 = require("../middleware/authMiddleware");
const requireRole_1 = require("../middleware/requireRole");
const vendorDetailModel_1 = require("../models/vendorDetailModel");
const shopCatalogue_1 = require("../services/shopCatalogue");
// Routes for a signed-in vendor about their own business. Every route here is vendor-only and
// reads the vendorId from the database (via requireRole), never from the request.
const router = express_1.default.Router();
router.get("/me", authMiddleware_1.requireAuth, (0, requireRole_1.requireRole)("vendor"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { vendorId } = req.currentUser;
        const vendor = vendorId ? yield vendorDetailModel_1.VendorDetails.findOne({ id: vendorId }, { ownerUserId: 0 }) : null;
        if (!vendor) {
            return res.status(404).json({ message: "We could not find your vendor profile." });
        }
        // In shop mode the "services" a vendor sees are their products, same as on the public pages.
        const [presented] = yield (0, shopCatalogue_1.presentVendors)([vendor]);
        return res.json(presented);
    }
    catch (error) {
        console.error("Failed to load vendor profile:", error);
        return res.status(500).json({ message: "We could not load your profile. Please try again." });
    }
}));
exports.default = router;
