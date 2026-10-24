"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseReason = exports.parseProductInput = exports.LIMITS = exports.placementForFit = exports.FIT_OPTIONS = exports.FIT_ZONES = exports.MAX_PRODUCTS_PER_VENDOR = void 0;
const dimensionRules_1 = require("./dimensionRules");
// Validation for the product form a vendor fills in (and the owner's edits). Pure functions, no database.
// Only the fields named here are ever read from a request: status, vendor, photos, cut-out, 3D model and
// rooms are decided by the server, never copied from the body.
exports.MAX_PRODUCTS_PER_VENDOR = 200;
// "How is it fitted?" Where a piece sits in a room. Most product types have one obvious answer (a sofa
// stands on the floor, a mirror hangs on the wall) and the rooms already know it from the type. These are the
// types whose answer varies, and the answers a vendor may give for each. The answer is stored as the
// product's `placement.zone`; the vendor can never send any other placement field.
exports.FIT_ZONES = ["floor", "wall", "ceiling", "surface"];
exports.FIT_OPTIONS = {
    lighting: ["floor", "wall", "ceiling", "surface"],
    "bedside-table": ["floor", "wall"],
    storage: ["floor", "wall"],
    vanity: ["floor", "wall"],
    accessories: ["surface", "wall"],
};
// The placement saved for a product the vendor said how it is fitted. Pieces that hold other things
// (a bedside table, a vanity) are marked as supports whichever way they are fitted; things that sit on
// something are drawn in front of it.
function placementForFit(slot, fit) {
    return Object.assign({ zone: fit, layer: fit === "surface" ? 2 : 1 }, (slot === "bedside-table" || slot === "vanity" ? { supports: true } : {}));
}
exports.placementForFit = placementForFit;
exports.LIMITS = {
    nameMin: 2,
    nameMax: 100,
    descriptionMax: 1000,
    priceMin: 1,
    priceMax: 1000000,
    stockMax: 9999,
    sizeMax: 1000,
    reasonMin: 3,
    reasonMax: 300,
};
// Strips control characters (they have no place in a product name) and collapses runs of whitespace.
function singleLine(value) {
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}
// A description may have line breaks; everything else is tidied the same way.
function multiLine(value) {
    return value
        .replace(/\r\n?/g, "\n")
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
function parseProductInput(body, context) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    const input = (typeof body === "object" && body !== null && !Array.isArray(body) ? body : {});
    const has = (key) => Object.prototype.hasOwnProperty.call(input, key);
    const create = context.mode === "create";
    const errors = {};
    const fields = {};
    if (create || has("name")) {
        const name = typeof input.name === "string" ? singleLine(input.name) : "";
        if (name.length < exports.LIMITS.nameMin || name.length > exports.LIMITS.nameMax) {
            errors.name = `Enter a name (${exports.LIMITS.nameMin} to ${exports.LIMITS.nameMax} characters).`;
        }
        else
            fields.name = name;
    }
    if (has("description") && input.description !== null && input.description !== undefined) {
        if (typeof input.description !== "string") {
            errors.description = "The description must be text.";
        }
        else {
            const description = multiLine(input.description);
            if (description.length > exports.LIMITS.descriptionMax) {
                errors.description = `Keep the description under ${exports.LIMITS.descriptionMax} characters.`;
            }
            else
                fields.description = description;
        }
    }
    else if (has("description")) {
        fields.description = "";
    }
    if (create || has("slot")) {
        const slot = typeof input.slot === "string" ? input.slot : "";
        if (!context.allowedTypes.has(slot))
            errors.slot = "Choose what kind of product this is.";
        else
            fields.slot = slot;
    }
    // How it is fitted: asked for the types whose place varies, refused for the rest.
    if (!errors.slot && (create || has("fit") || has("slot"))) {
        const finalSlot = (_c = (_a = fields.slot) !== null && _a !== void 0 ? _a : (_b = context.existing) === null || _b === void 0 ? void 0 : _b.slot) !== null && _c !== void 0 ? _c : "";
        const options = (_d = context.fitOptions) === null || _d === void 0 ? void 0 : _d.get(finalSlot);
        const raw = input.fit;
        const given = raw !== undefined && raw !== null;
        if (options) {
            const slotChanged = has("slot") && fields.slot !== ((_e = context.existing) === null || _e === void 0 ? void 0 : _e.slot);
            const stored = (_g = (_f = context.existing) === null || _f === void 0 ? void 0 : _f.placement) === null || _g === void 0 ? void 0 : _g.zone;
            if (!given) {
                // Needed for a new product, and when the type was changed to one that asks and nothing valid is stored.
                if (create || (slotChanged && !(stored && options.includes(stored))))
                    errors.fit = "Choose how it is fitted.";
            }
            else if (typeof raw === "string" && options.includes(raw)) {
                fields.fit = raw;
            }
            else {
                errors.fit = "Choose how it is fitted.";
            }
        }
        else if (given) {
            errors.fit = "This type of product does not need that.";
        }
    }
    if (create || has("price")) {
        const price = input.price;
        if (!isNumber(price) || !Number.isInteger(price) || price < exports.LIMITS.priceMin || price > exports.LIMITS.priceMax) {
            errors.price = `Enter the price in whole rupees (${exports.LIMITS.priceMin} to ${exports.LIMITS.priceMax.toLocaleString("en-IN")}).`;
        }
        else
            fields.price = price;
    }
    if (create || has("stock")) {
        const stock = input.stock;
        if (stock === null)
            fields.stock = null;
        else if (isNumber(stock) && Number.isInteger(stock) && stock >= 0 && stock <= exports.LIMITS.stockMax) {
            fields.stock = stock;
        }
        else if (stock === undefined) {
            errors.stock = "Enter how many you have, or choose \"I don't count my stock\".";
        }
        else {
            errors.stock = `Stock must be a whole number from 0 to ${exports.LIMITS.stockMax}.`;
        }
    }
    let warnings = [];
    if (has("dimensionsCm")) {
        const raw = input.dimensionsCm;
        if (raw === null) {
            fields.dimensionsCm = null;
        }
        else if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
            const { w, h, d } = raw;
            const dimensionOk = (value) => isNumber(value) && value > 0 && value <= exports.LIMITS.sizeMax;
            if (!dimensionOk(w) || !dimensionOk(h) || (d !== undefined && d !== null && !dimensionOk(d))) {
                errors.dimensionsCm = `Enter the width and height in cm (and the depth if you know it), each between 0 and ${exports.LIMITS.sizeMax}.`;
            }
            else {
                fields.dimensionsCm = Object.assign({ w: w, h: h }, (isNumber(d) ? { d } : {}));
            }
        }
        else {
            errors.dimensionsCm = "The size must be width, height and depth in cm.";
        }
    }
    // The same plausibility check the seed and the model use: a sofa typed in inches is refused, an
    // unusual-but-possible size only warns. Checked against the final slot and the product's own picture.
    if (has("dimensionsCm") && !errors.dimensionsCm && !errors.slot) {
        const slot = (_k = (_h = fields.slot) !== null && _h !== void 0 ? _h : (_j = context.existing) === null || _j === void 0 ? void 0 : _j.slot) !== null && _k !== void 0 ? _k : "";
        // A light that hangs on the wall is checked as a wall light, not as a floor lamp.
        const zone = ((_p = (_l = fields.fit) !== null && _l !== void 0 ? _l : (_o = (_m = context.existing) === null || _m === void 0 ? void 0 : _m.placement) === null || _o === void 0 ? void 0 : _o.zone) !== null && _p !== void 0 ? _p : "floor");
        const result = (0, dimensionRules_1.validateDimensions)({
            slot,
            cutoutUrl: (_r = (_q = context.existing) === null || _q === void 0 ? void 0 : _q.cutoutUrl) !== null && _r !== void 0 ? _r : null,
            dimensionsCm: (_s = fields.dimensionsCm) !== null && _s !== void 0 ? _s : null,
            placement: { zone, layer: (_v = (_u = (_t = context.existing) === null || _t === void 0 ? void 0 : _t.placement) === null || _u === void 0 ? void 0 : _u.layer) !== null && _v !== void 0 ? _v : null },
        });
        if (result.errors.length > 0)
            errors.dimensionsCm = result.errors[0].message;
        warnings = result.warnings.map((issue) => issue.message);
    }
    if (Object.keys(errors).length > 0)
        return { ok: false, errors };
    if (!create && Object.keys(fields).length === 0)
        return { ok: false, errors: { form: "There is nothing to change." } };
    return { ok: true, fields, warnings };
}
exports.parseProductInput = parseProductInput;
// The owner's reason when rejecting a product.
function parseReason(value) {
    const reason = typeof value === "string" ? singleLine(value) : "";
    if (reason.length < exports.LIMITS.reasonMin)
        return { ok: false, error: "Add a few words so the vendor knows what to change." };
    if (reason.length > exports.LIMITS.reasonMax)
        return { ok: false, error: `Keep it under ${exports.LIMITS.reasonMax} characters.` };
    return { ok: true, reason };
}
exports.parseReason = parseReason;
