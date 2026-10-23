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
exports.publicVendorQuery = exports.getPublicVendorFilter = exports.PUBLIC_VENDOR_FILTER = exports.NOT_PUBLIC_STATUSES = void 0;
const essentialModel_1 = require("../models/essentialModel");
const featureFlags_1 = require("./featureFlags");
const productVisibility_1 = require("./productVisibility");
// A profile that is pending or paused is never public and cannot take orders. A missing status means
// active, which keeps every profile created before sign-up existed visible.
exports.NOT_PUBLIC_STATUSES = ["pending", "paused"];
// Services mode (SERVICES_ENABLED=true): a vendor is public once it has at least one service listed.
exports.PUBLIC_VENDOR_FILTER = {
    status: { $nin: exports.NOT_PUBLIC_STATUSES },
    "categories.0": { $exists: true },
};
// Shop mode (the default): a vendor is public once it has at least one LIVE product.
function shopVendorFilter() {
    return __awaiter(this, void 0, void 0, function* () {
        const vendorIds = yield essentialModel_1.Essentials.distinct("vendorId", productVisibility_1.PUBLIC_PRODUCT_FILTER);
        return { status: { $nin: exports.NOT_PUBLIC_STATUSES }, id: { $in: vendorIds } };
    });
}
function getPublicVendorFilter() {
    return __awaiter(this, void 0, void 0, function* () {
        return (0, featureFlags_1.servicesEnabled)() ? exports.PUBLIC_VENDOR_FILTER : shopVendorFilter();
    });
}
exports.getPublicVendorFilter = getPublicVendorFilter;
// Always combine with $and: the shop filter constrains `id`, so spreading it next to `{ id }` would
// silently replace the id being looked up.
function publicVendorQuery(extra = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        return { $and: [extra, yield getPublicVendorFilter()] };
    });
}
exports.publicVendorQuery = publicVendorQuery;
