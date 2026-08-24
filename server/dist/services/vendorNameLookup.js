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
exports.getVendorNameMap = void 0;
const vendorDetailModel_1 = require("../models/vendorDetailModel");
// Essentials only store vendorId — shared by essentialRoutes.ts and
// essentialRoomRoutes.ts to enrich responses with a display name without
// duplicating the same lookup in both files.
function getVendorNameMap(vendorIds) {
    return __awaiter(this, void 0, void 0, function* () {
        const uniqueIds = Array.from(new Set(vendorIds));
        if (uniqueIds.length === 0)
            return new Map();
        const vendors = yield vendorDetailModel_1.VendorDetails.find({ id: { $in: uniqueIds } }, { id: 1, name: 1 });
        return new Map(vendors.map((vendor) => [
            vendor.get("id"),
            vendor.get("name"),
        ]));
    });
}
exports.getVendorNameMap = getVendorNameMap;
