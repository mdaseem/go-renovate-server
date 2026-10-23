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
exports.vendorIdsMatchingProducts = exports.vendorIdsWithSlots = exports.presentVendors = exports.buildShopCategories = exports.slotIcon = void 0;
const categoryModel_1 = require("../models/categoryModel");
const essentialModel_1 = require("../models/essentialModel");
const featureFlags_1 = require("./featureFlags");
const productVisibility_1 = require("./productVisibility");
// Shop mode (SERVICES_ENABLED off): the vendor pages show a vendor's PRODUCTS in the same shape the
// pages already use for services - `categories[].services[]` - so the list, filters, search, category
// pages and vendor page keep their layout. Here "category" = the product's slot (Sofa, Lighting...) and
// each entry in `services` is a product (it carries a `product` block that the frontend uses to switch
// the wording and the cart). The cart and orders for products go through /essentials, never /orders.
const SLOT_ICONS = {
    sofa: "🛋️",
    "coffee-table": "🪑",
    rug: "🧶",
    lighting: "💡",
    "wall-decor": "🖼️",
    decor: "🪴",
    bed: "🛏️",
    wardrobe: "🚪",
    "bedside-table": "🪑",
    vanity: "🪞",
    mirror: "🪞",
    storage: "🗄️",
    accessories: "🧴",
    "dining-table": "🍽️",
    chairs: "🪑",
    countertop: "🍳",
};
const DEFAULT_SLOT_ICON = "📦";
// The emoji shown for a product type; unknown types get a plain box.
function slotIcon(slotId) {
    var _a;
    return (_a = SLOT_ICONS[slotId]) !== null && _a !== void 0 ? _a : DEFAULT_SLOT_ICON;
}
exports.slotIcon = slotIcon;
function humanize(slotId) {
    const text = slotId.replace(/-/g, " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
}
// slot id -> label, per room category (a slot id such as "rug" is called "Bath mat" in Bathroom).
function loadSlotLabels() {
    return __awaiter(this, void 0, void 0, function* () {
        const categories = yield categoryModel_1.Categories.find({}, { slug: 1, slots: 1 }).lean();
        const bySlug = new Map();
        for (const category of categories) {
            const labels = new Map();
            for (const slot of category.slots || []) {
                if (slot.id && slot.label)
                    labels.set(slot.id, slot.label);
            }
            bySlug.set(category.slug, labels);
        }
        return bySlug;
    });
}
function labelFor(slot, categorySlugs, labels) {
    var _a;
    for (const slug of categorySlugs) {
        const label = (_a = labels.get(slug)) === null || _a === void 0 ? void 0 : _a.get(slot);
        if (label)
            return label;
    }
    // A product that belongs to no room (a vendor's, until the owner adds it to rooms) still gets the
    // slot's usual name, so "Coffee Table" is spelled the same on every vendor's page.
    for (const slotLabels of labels.values()) {
        const label = slotLabels.get(slot);
        if (label)
            return label;
    }
    return humanize(slot);
}
// vendorId -> that vendor's products grouped by slot. One query for the products and one tiny one for
// the labels, however many vendors are asked for.
function buildShopCategories(vendorIds) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const result = new Map();
        if (vendorIds.length === 0)
            return result;
        const [products, labels] = yield Promise.all([
            essentialModel_1.Essentials.find(Object.assign({ vendorId: { $in: vendorIds } }, productVisibility_1.PUBLIC_PRODUCT_FILTER)).sort({ name: 1 }).lean(),
            loadSlotLabels(),
        ]);
        const grouped = new Map();
        for (const product of products) {
            const vendorId = product.vendorId;
            const slot = product.slot;
            const stock = typeof product.stock === "number" ? product.stock : null;
            const isExternal = product.purchaseMode === "external-store";
            // Real photos first; the vendor's cut-out illustration (the one the room preview draws) stands in
            // until a photo exists.
            const photos = (product.images || []).filter(Boolean);
            const images = photos.length > 0 ? photos : product.cutoutUrl ? [product.cutoutUrl] : [];
            const item = {
                id: String(product._id),
                name: product.name,
                description: product.description || "",
                price: product.price,
                imageUrl: images[0],
                images,
                // External-store items are bought elsewhere, so their stock is not ours to judge.
                isAvailable: isExternal || stock === null || stock > 0,
                product: {
                    stock: isExternal ? null : stock,
                    purchaseMode: isExternal ? "external-store" : "on-platform",
                    externalStoreUrl: isExternal ? product.externalStoreUrl : undefined,
                    dimensionsCm: product.dimensionsCm
                        ? { w: product.dimensionsCm.w, h: product.dimensionsCm.h, d: product.dimensionsCm.d }
                        : undefined,
                    slot,
                },
            };
            if (!grouped.has(vendorId))
                grouped.set(vendorId, new Map());
            const byVendor = grouped.get(vendorId);
            if (!byVendor.has(slot)) {
                byVendor.set(slot, {
                    id: slot,
                    label: labelFor(slot, product.categorySlugs || [], labels),
                    icon: (_a = SLOT_ICONS[slot]) !== null && _a !== void 0 ? _a : DEFAULT_SLOT_ICON,
                    services: [],
                });
            }
            byVendor.get(slot).services.push(item);
        }
        for (const [vendorId, bySlot] of grouped) {
            result.set(vendorId, Array.from(bySlot.values()).sort((a, b) => a.label.localeCompare(b.label)));
        }
        return result;
    });
}
exports.buildShopCategories = buildShopCategories;
// Swaps the `categories` of vendor documents for their product categories (shop mode only).
function presentVendors(vendors) {
    return __awaiter(this, void 0, void 0, function* () {
        if ((0, featureFlags_1.servicesEnabled)())
            return vendors;
        const plain = vendors.map((vendor) => {
            const doc = vendor;
            return (typeof doc.toObject === "function" ? doc.toObject() : Object.assign({}, vendor));
        });
        const categories = yield buildShopCategories(plain.map((vendor) => String(vendor.id)));
        return plain.map((vendor) => { var _a; return (Object.assign(Object.assign({}, vendor), { categories: (_a = categories.get(String(vendor.id))) !== null && _a !== void 0 ? _a : [] })); });
    });
}
exports.presentVendors = presentVendors;
// Vendor ids that sell at least one product in any of these slots (the category filter in shop mode).
function vendorIdsWithSlots(slotIds) {
    return __awaiter(this, void 0, void 0, function* () {
        return essentialModel_1.Essentials.distinct("vendorId", Object.assign({ slot: { $in: slotIds } }, productVisibility_1.PUBLIC_PRODUCT_FILTER));
    });
}
exports.vendorIdsWithSlots = vendorIdsWithSlots;
// Vendor ids with a product whose name, or whose slot name, matches the search pattern.
function vendorIdsMatchingProducts(pattern) {
    return __awaiter(this, void 0, void 0, function* () {
        const categories = yield categoryModel_1.Categories.find({}, { slots: 1 }).lean();
        const matchingSlots = new Set();
        for (const category of categories) {
            for (const slot of category.slots || []) {
                if (slot.id && (pattern.test(slot.label || "") || pattern.test(slot.id)))
                    matchingSlots.add(slot.id);
            }
        }
        return essentialModel_1.Essentials.distinct("vendorId", Object.assign({ $or: [{ name: pattern }, { slot: { $in: Array.from(matchingSlots) } }] }, productVisibility_1.PUBLIC_PRODUCT_FILTER));
    });
}
exports.vendorIdsMatchingProducts = vendorIdsMatchingProducts;
