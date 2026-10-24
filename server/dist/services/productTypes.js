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
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadProductTypes = exports.OTHER_TYPE_ID = void 0;
const categoryModel_1 = require("../models/categoryModel");
const shopCatalogue_1 = require("./shopCatalogue");
const vendorProductRules_1 = require("./vendorProductRules");
// The product types a vendor can pick (a "slot": Sofa, Lighting...). They are the slots the room
// categories already define, plus "Other" for anything else. "Other" products sell in the shop but can
// never be put into rooms (no room has an "other" slot).
exports.OTHER_TYPE_ID = "other";
function loadProductTypes() {
    return __awaiter(this, void 0, void 0, function* () {
        const categories = yield categoryModel_1.Categories.find({}, { slug: 1, slots: 1, sortOrder: 1 })
            .sort({ sortOrder: 1 })
            .lean();
        const types = new Map();
        for (const category of categories) {
            for (const slot of category.slots || []) {
                if (!slot.id || !slot.label)
                    continue;
                const existing = types.get(slot.id);
                if (existing) {
                    existing.rooms.push(category.slug);
                }
                else {
                    types.set(slot.id, { id: slot.id, label: slot.label, icon: (0, shopCatalogue_1.slotIcon)(slot.id), rooms: [category.slug] });
                }
            }
        }
        for (const [id, fits] of Object.entries(vendorProductRules_1.FIT_OPTIONS)) {
            const type = types.get(id);
            if (type)
                type.fits = fits;
        }
        types.set(exports.OTHER_TYPE_ID, { id: exports.OTHER_TYPE_ID, label: "Other", icon: (0, shopCatalogue_1.slotIcon)(exports.OTHER_TYPE_ID), rooms: [] });
        return types;
    });
}
exports.loadProductTypes = loadProductTypes;
