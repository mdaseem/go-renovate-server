"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRole = exports.isReservedAdminEmail = exports.isAdminEmail = exports.ROLES = void 0;
exports.ROLES = ["customer", "vendor", "admin"];
// Read lazily: index.ts calls dotenv.config() after its imports have run.
let warnedUnverified = false;
function configuredAdminEmails() {
    var _a;
    return ((_a = process.env.ADMIN_EMAILS) !== null && _a !== void 0 ? _a : "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
}
function adminEmails() {
    const list = configuredAdminEmails();
    // Fail closed: while Google logins are not verified (no GOOGLE_CLIENT_ID), anyone could claim an
    // admin's email, so nobody is treated as admin until it is set.
    if (list.length > 0 && !process.env.GOOGLE_CLIENT_ID) {
        if (!warnedUnverified) {
            warnedUnverified = true;
            console.warn("[auth] ADMIN_EMAILS is set but GOOGLE_CLIENT_ID is not, so admin access is DISABLED (Google logins are not verified). Set GOOGLE_CLIENT_ID.");
        }
        return [];
    }
    return list;
}
function isAdminEmail(email) {
    return typeof email === "string" && adminEmails().includes(email.trim().toLowerCase());
}
exports.isAdminEmail = isAdminEmail;
// True for any email listed in ADMIN_EMAILS, whether or not admin access is currently switched on.
// Signup uses this so nobody can register a password account on an admin's email.
function isReservedAdminEmail(email) {
    return typeof email === "string" && configuredAdminEmails().includes(email.trim().toLowerCase());
}
exports.isReservedAdminEmail = isReservedAdminEmail;
// An admin email always wins (so removing it from ADMIN_EMAILS takes admin away immediately).
// Otherwise the stored role, and anyone without one - every account created before roles
// existed - is a customer.
function resolveRole(user) {
    if (isAdminEmail(user.get("userEmail")))
        return "admin";
    const stored = user.get("role");
    return stored === "vendor" ? "vendor" : "customer";
}
exports.resolveRole = resolveRole;
