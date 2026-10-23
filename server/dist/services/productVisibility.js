"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPublicStatus = exports.effectiveStatus = exports.PUBLIC_PRODUCT_FILTER = exports.NOT_PUBLIC_PRODUCT_STATUSES = exports.PRODUCT_STATUSES = void 0;
// A product a vendor created starts "pending" (waiting for the owner's review) and can later be "live",
// "paused" (by the vendor or by the owner) or "rejected". A product with NO status is live: every
// product that existed before vendors could add products (the seeded catalogue) keeps working untouched,
// so the field has no schema default, the same way `vendorDetails.status` works.
exports.PRODUCT_STATUSES = ["pending", "live", "paused", "rejected"];
exports.NOT_PUBLIC_PRODUCT_STATUSES = ["pending", "paused", "rejected"];
// Every public path that reads products (the shop, vendor pages, the room pickers, search, availability,
// saved designs and ordering) must combine its query with this filter, so a product that is not live is
// never shown or sold. Use it as `{ ...PUBLIC_PRODUCT_FILTER }` inside a query.
exports.PUBLIC_PRODUCT_FILTER = {
    status: { $nin: exports.NOT_PUBLIC_PRODUCT_STATUSES },
};
// What a stored status means to a reader: a missing status is live.
function effectiveStatus(status) {
    return typeof status === "string" && exports.PRODUCT_STATUSES.includes(status)
        ? status
        : "live";
}
exports.effectiveStatus = effectiveStatus;
function isPublicStatus(status) {
    return !exports.NOT_PUBLIC_PRODUCT_STATUSES.includes(String(status !== null && status !== void 0 ? status : ""));
}
exports.isPublicStatus = isPublicStatus;
