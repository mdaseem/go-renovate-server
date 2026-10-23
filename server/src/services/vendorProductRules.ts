import { validateDimensions } from "./dimensionRules";

// Validation for the product form a vendor fills in (and the owner's edits). Pure functions, no database.
// Only the fields named here are ever read from a request: status, vendor, photos, cut-out, 3D model and
// rooms are decided by the server, never copied from the body.

export const MAX_PRODUCTS_PER_VENDOR = 200;
export const LIMITS = {
  nameMin: 2,
  nameMax: 100,
  descriptionMax: 1000,
  priceMin: 1,
  priceMax: 1_000_000,
  stockMax: 9999,
  sizeMax: 1000,
  reasonMin: 3,
  reasonMax: 300,
} as const;

export interface ProductSize {
  w: number;
  h: number;
  d?: number;
}

export interface ProductFields {
  name: string;
  // "" means "clear it".
  description: string;
  slot: string;
  price: number;
  // null = not tracked (always available).
  stock: number | null;
  dimensionsCm: ProductSize | null;
}

// What the existing product already has, so a size can be checked against its type and its picture.
export interface ExistingProduct {
  slot?: string;
  cutoutUrl?: string | null;
  placement?: { zone?: string | null; layer?: number | null } | null;
}

export type ParsedProduct =
  | { ok: true; fields: Partial<ProductFields>; warnings: string[] }
  | { ok: false; errors: Record<string, string> };

// Strips control characters (they have no place in a product name) and collapses runs of whitespace.
function singleLine(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

// A description may have line breaks; everything else is tidied the same way.
function multiLine(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function parseProductInput(
  body: unknown,
  context: { mode: "create" | "update"; allowedTypes: Set<string>; existing?: ExistingProduct },
): ParsedProduct {
  const input = (typeof body === "object" && body !== null && !Array.isArray(body) ? body : {}) as Record<
    string,
    unknown
  >;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);
  const create = context.mode === "create";
  const errors: Record<string, string> = {};
  const fields: Partial<ProductFields> = {};

  if (create || has("name")) {
    const name = typeof input.name === "string" ? singleLine(input.name) : "";
    if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
      errors.name = `Enter a name (${LIMITS.nameMin} to ${LIMITS.nameMax} characters).`;
    } else fields.name = name;
  }

  if (has("description") && input.description !== null && input.description !== undefined) {
    if (typeof input.description !== "string") {
      errors.description = "The description must be text.";
    } else {
      const description = multiLine(input.description);
      if (description.length > LIMITS.descriptionMax) {
        errors.description = `Keep the description under ${LIMITS.descriptionMax} characters.`;
      } else fields.description = description;
    }
  } else if (has("description")) {
    fields.description = "";
  }

  if (create || has("slot")) {
    const slot = typeof input.slot === "string" ? input.slot : "";
    if (!context.allowedTypes.has(slot)) errors.slot = "Choose what kind of product this is.";
    else fields.slot = slot;
  }

  if (create || has("price")) {
    const price = input.price;
    if (!isNumber(price) || !Number.isInteger(price) || price < LIMITS.priceMin || price > LIMITS.priceMax) {
      errors.price = `Enter the price in whole rupees (${LIMITS.priceMin} to ${LIMITS.priceMax.toLocaleString("en-IN")}).`;
    } else fields.price = price;
  }

  if (create || has("stock")) {
    const stock = input.stock;
    if (stock === null) fields.stock = null;
    else if (isNumber(stock) && Number.isInteger(stock) && stock >= 0 && stock <= LIMITS.stockMax) {
      fields.stock = stock;
    } else if (stock === undefined) {
      errors.stock = "Enter how many you have, or choose \"I don't count my stock\".";
    } else {
      errors.stock = `Stock must be a whole number from 0 to ${LIMITS.stockMax}.`;
    }
  }

  let warnings: string[] = [];
  if (has("dimensionsCm")) {
    const raw = input.dimensionsCm;
    if (raw === null) {
      fields.dimensionsCm = null;
    } else if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      const { w, h, d } = raw as Record<string, unknown>;
      const dimensionOk = (value: unknown) => isNumber(value) && value > 0 && value <= LIMITS.sizeMax;
      if (!dimensionOk(w) || !dimensionOk(h) || (d !== undefined && d !== null && !dimensionOk(d))) {
        errors.dimensionsCm = `Enter the width and height in cm (and the depth if you know it), each between 0 and ${LIMITS.sizeMax}.`;
      } else {
        fields.dimensionsCm = { w: w as number, h: h as number, ...(isNumber(d) ? { d } : {}) };
      }
    } else {
      errors.dimensionsCm = "The size must be width, height and depth in cm.";
    }
  }

  // The same plausibility check the seed and the model use: a sofa typed in inches is refused, an
  // unusual-but-possible size only warns. Checked against the final slot and the product's own picture.
  if (has("dimensionsCm") && !errors.dimensionsCm && !errors.slot) {
    const slot = fields.slot ?? context.existing?.slot ?? "";
    const zone = (context.existing?.placement?.zone ?? "floor") as "floor" | "wall" | "ceiling" | "surface";
    const result = validateDimensions({
      slot,
      cutoutUrl: context.existing?.cutoutUrl ?? null,
      dimensionsCm: fields.dimensionsCm ?? null,
      placement: { zone, layer: context.existing?.placement?.layer ?? null },
    });
    if (result.errors.length > 0) errors.dimensionsCm = result.errors[0].message;
    warnings = result.warnings.map((issue) => issue.message);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!create && Object.keys(fields).length === 0) return { ok: false, errors: { form: "There is nothing to change." } };
  return { ok: true, fields, warnings };
}

// The owner's reason when rejecting a product.
export function parseReason(value: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = typeof value === "string" ? singleLine(value) : "";
  if (reason.length < LIMITS.reasonMin) return { ok: false, error: "Add a few words so the vendor knows what to change." };
  if (reason.length > LIMITS.reasonMax) return { ok: false, error: `Keep it under ${LIMITS.reasonMax} characters.` };
  return { ok: true, reason };
}
