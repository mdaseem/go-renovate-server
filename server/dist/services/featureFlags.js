"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.servicesEnabled = void 0;
// The one switch for the renovation-SERVICES marketplace. Off by default: the site is a product shop
// (vendors sell products, buyers add them to a cart, and rooms bundle products). Setting
// SERVICES_ENABLED=true brings the service pages back exactly as they were - nothing is deleted.
// The frontend has a matching NEXT_PUBLIC_SERVICES_ENABLED for page copy and links; keep the two equal.
function servicesEnabled() {
    return process.env.SERVICES_ENABLED === "true";
}
exports.servicesEnabled = servicesEnabled;
