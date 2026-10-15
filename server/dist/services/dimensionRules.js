"use strict";
// Plausibility checks for a product's real-world size (dimensionsCm, in cm).
//
// The room preview draws every product to scale from these numbers, so a wrong
// size is a wrong picture: a sofa typed in inches looks like a footstool, an
// extra zero makes a lamp fill the room. This module is the single place that
// knows what "plausible" means. It is used by
//   - the Essential model (a product that fails with an ERROR cannot be saved),
//   - seed/seedEssentials.js (checks the seed data before writing anything),
//   - scripts/checkDimensions.ts (read-only audit of what is in the database),
//   - and, later, the vendor upload form (same function, same messages).
// WARNINGS never block a save — they are "check this" nudges, since a genuinely
// unusual product (a 4 m sofa) must still be possible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatIssues = exports.validateDimensions = exports.ruleFor = exports.MODEL_SOURCES = exports.MODEL_MISMATCH_TOLERANCE = exports.MODEL_CLOSE_TOLERANCE = void 0;
// A 3D model is drawn at the product's real size, so a model that is clearly a
// different shape than the listing is a wrong picture. Same thresholds as the
// frontend viewer (utils/gl/modelCheck.ts) - keep the two in step.
exports.MODEL_CLOSE_TOLERANCE = 0.05;
exports.MODEL_MISMATCH_TOLERANCE = 0.25;
exports.MODEL_SOURCES = ["vendor", "commissioned", "scanned", "test-placeholder"];
const r = (w, h, d) => ({ w, h, d });
// Usual sizes in cm, per slot (and per placement zone where the same slot holds
// very different things: "lighting" is a floor lamp, a wall sconce, a pendant…).
// `any` is the fallback for a zone with no entry of its own.
const RULES = {
    sofa: { any: r([90, 380], [60, 120], [60, 180]) },
    "coffee-table": { any: r([40, 160], [25, 60], [30, 100]) },
    rug: { any: r([30, 420], [0, 6], [25, 420]) },
    bed: { any: r([80, 220], [40, 160], [150, 240]) },
    wardrobe: { any: r([40, 300], [100, 260], [25, 80]) },
    "bedside-table": {
        floor: r([25, 70], [30, 80], [25, 60]),
        wall: r([20, 120], [5, 60], [10, 40]),
        any: r([20, 120], [5, 80], [10, 60]),
    },
    vanity: {
        floor: r([40, 200], [70, 100], [30, 70]),
        wall: r([40, 200], [25, 70], [25, 60]),
        any: r([40, 200], [25, 100], [25, 70]),
    },
    mirror: { any: r([25, 200], [25, 220], [0, 12]) },
    storage: {
        floor: r([20, 150], [40, 230], [15, 70]),
        wall: r([10, 120], [8, 100], [5, 50]),
        any: r([10, 150], [8, 230], [5, 70]),
    },
    "dining-table": { any: r([60, 300], [60, 90], [50, 120]) },
    chairs: { any: r([30, 300], [40, 120], [30, 70]) },
    countertop: { any: r([5, 60], [5, 60], [5, 60]) },
    accessories: { any: r([3, 100], [2, 80], [2, 60]) },
    "wall-decor": { any: r([10, 200], [3, 250], [0, 25]) },
    decor: {
        surface: r([3, 100], [3, 150], [3, 100]),
        any: r([3, 200], [3, 250], [3, 200]),
    },
    lighting: {
        floor: r([15, 150], [60, 230], [15, 100]),
        ceiling: r([10, 200], [1, 200], [5, 200]),
        wall: r([3, 100], [1, 100], [3, 40]),
        surface: r([8, 60], [15, 90], [8, 60]),
        any: r([3, 200], [1, 230], [3, 200]),
    },
};
// For a slot we have no entry for: wide enough not to cry wolf, tight enough to catch typos.
const GENERIC = r([1, 400], [0.5, 300], [0.5, 300]);
function ruleFor(slot, zone, isFlatCovering) {
    var _a, _b;
    if (isFlatCovering)
        return RULES.rug.any;
    const entry = RULES[slot];
    if (!entry)
        return GENERIC;
    return (_b = (_a = entry[zone]) !== null && _a !== void 0 ? _a : entry.any) !== null && _b !== void 0 ? _b : GENERIC;
}
exports.ruleFor = ruleFor;
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const inRange = (value, [min, max]) => value >= min && value <= max;
const fmt = (value) => String(Number(value.toFixed(1)));
const FIELD_NAMES = { w: "width", h: "height", d: "depth" };
// What the number probably is, when it is out of range: the common mistakes.
function explain(value, range, label) {
    const [min, max] = range;
    if (value < min && inRange(value * 2.54, range)) {
        return `${label} ${fmt(value)} looks like inches (${fmt(value)} in ≈ ${fmt(value * 2.54)} cm) — sizes must be in cm`;
    }
    if (value > max && inRange(value / 10, range)) {
        return `${label} ${fmt(value)} cm looks 10× too large (millimetres, or an extra zero?)`;
    }
    if (value < min && value < 10 && inRange(value * 100, range)) {
        return `${label} ${fmt(value)} looks like metres — sizes must be in cm`;
    }
    return `${label} ${fmt(value)} cm is outside the usual ${fmt(min)}–${fmt(max)} cm`;
}
function validateDimensions(input) {
    var _a, _b, _c, _d, _e;
    const errors = [];
    const warnings = [];
    const dims = (_a = input.dimensionsCm) !== null && _a !== void 0 ? _a : undefined;
    const hasCutout = Boolean(input.cutoutUrl);
    // A cutout is drawn to scale: without a width and height there is nothing to scale it to.
    if (hasCutout && (!dims || !isNumber(dims.w) || !isNumber(dims.h))) {
        errors.push({
            field: "dimensionsCm",
            message: "A product with a cutout image needs a width and a height in cm",
        });
    }
    checkModelFit(input, errors, warnings);
    if (!dims)
        return { errors, warnings };
    const zone = ((_c = (_b = input.placement) === null || _b === void 0 ? void 0 : _b.zone) !== null && _c !== void 0 ? _c : "floor");
    const isFlat = zone === "floor" && ((_e = (_d = input.placement) === null || _d === void 0 ? void 0 : _d.layer) !== null && _e !== void 0 ? _e : 1) === 0;
    const rule = ruleFor(input.slot, zone, isFlat);
    ["w", "h", "d"].forEach((field) => {
        const value = dims[field];
        if (value === undefined || value === null)
            return;
        const label = FIELD_NAMES[field][0].toUpperCase() + FIELD_NAMES[field].slice(1);
        if (!isNumber(value) || value < 0) {
            errors.push({ field, message: `${label} must be a number of cm, zero or more` });
            return;
        }
        if ((field === "w" || field === "h") && value === 0) {
            errors.push({ field, message: `${label} must be more than 0 cm` });
            return;
        }
        if (!inRange(value, rule[field])) {
            warnings.push({ field, message: explain(value, rule[field], label) });
        }
    });
    // A flat floor covering is drawn from its depth (its thickness is meaningless).
    if (isFlat && !isNumber(dims.d)) {
        warnings.push({
            field: "d",
            message: "A rug or mat should have a depth (its length into the room) so it is drawn the right size",
        });
    }
    return { errors, warnings };
}
exports.validateDimensions = validateDimensions;
// Provenance and size of the 3D model against the listed size. A placeholder
// model (our own test files) is only ever a warning: it is never the real product.
function checkModelFit(input, errors, warnings) {
    const model = input.model3d;
    if (!model)
        return;
    const placeholder = model.source === "test-placeholder";
    const flag = (message, severe) => (severe && !placeholder ? errors : warnings).push({ field: "model3d", message });
    if (!model.source || !exports.MODEL_SOURCES.includes(model.source)) {
        errors.push({ field: "model3d", message: `A 3D model needs a source (${exports.MODEL_SOURCES.join(", ")})` });
    }
    const raw = model.sizeCm;
    const size = raw && isNumber(raw.w) && isNumber(raw.h) && isNumber(raw.d) ? { w: raw.w, h: raw.h, d: raw.d } : null;
    if (!size || size.w <= 0 || size.h <= 0 || size.d <= 0) {
        errors.push({ field: "model3d", message: "A 3D model needs its measured size (sizeCm w, h, d in cm - the viewer lab reports it)" });
        return;
    }
    const listed = input.dimensionsCm;
    if (!listed)
        return;
    ["w", "h", "d"].forEach((axis) => {
        const wanted = listed[axis];
        if (!isNumber(wanted) || wanted <= 0)
            return;
        const off = Math.abs(size[axis] - wanted) / wanted;
        const text = `3D model ${FIELD_NAMES[axis]} ${fmt(size[axis])} cm vs ${fmt(wanted)} cm listed`;
        if (off > exports.MODEL_MISMATCH_TOLERANCE)
            flag(`${text} - the model does not match the product`, true);
        else if (off > exports.MODEL_CLOSE_TOLERANCE)
            flag(`${text} - a little off`, false);
    });
}
function formatIssues(issues) {
    return issues.map((issue) => issue.message).join("; ");
}
exports.formatIssues = formatIssues;
