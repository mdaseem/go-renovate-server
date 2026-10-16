"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeContainsFilter = exports.escapeRegExp = void 0;
// Escapes regex metacharacters in free text before it is used to build a RegExp or a Mongo $regex,
// so a query like "A/C (window)" cannot throw, match unintended text, or be used to build a pattern
// that runs for ages (ReDoS).
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
exports.escapeRegExp = escapeRegExp;
const MAX_SEARCH_TEXT_LENGTH = 100;
// Turns untrusted search text (for example what the AI model passes to a tool) into a safe,
// case-insensitive literal-match filter value, or null if there is nothing usable. Non-strings
// (objects like { "$ne": "" }) are rejected rather than coerced.
function safeContainsFilter(value) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim().slice(0, MAX_SEARCH_TEXT_LENGTH);
    if (!trimmed)
        return null;
    return { $regex: escapeRegExp(trimmed), $options: "i" };
}
exports.safeContainsFilter = safeContainsFilter;
