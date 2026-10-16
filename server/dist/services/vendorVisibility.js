"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLIC_VENDOR_FILTER = void 0;
// What the public /vendors pages may show: profiles that are not pending or paused (a missing status
// means active, which keeps every profile created before sign-up existed visible), and that have at
// least one service listed - a seller of products only has nothing to show on the services pages.
exports.PUBLIC_VENDOR_FILTER = {
    status: { $nin: ["pending", "paused"] },
    "categories.0": { $exists: true },
};
