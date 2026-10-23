import express, { Request, Response, Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/authMiddleware";
import { CurrentUser, requireRole } from "../middleware/requireRole";
import { Essentials } from "../models/essentialModel";
import { effectiveStatus, NOT_PUBLIC_PRODUCT_STATUSES, ProductStatus } from "../services/productVisibility";
import { loadProductTypes, OTHER_TYPE_ID, ProductType } from "../services/productTypes";
import { makeRateWindow } from "../services/rateWindow";
import { MAX_PRODUCTS_PER_VENDOR, parseProductInput } from "../services/vendorProductRules";

// The vendor's own products: add, edit, pause, resume, duplicate. Every route is vendor-only and works on
// products whose `vendorId` is the vendor's own, read from the database (requireRole), never from the
// request. A new product starts "pending" and is not public until the owner approves it
// (routes/adminProductRoutes.ts). Photos are not part of this yet: a product has none and the pages draw
// the default placeholder (the photo step comes later).
const router: Router = express.Router();
router.use(requireAuth, requireRole("vendor"));

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;
// Creating (or duplicating) products: 30 an hour per vendor.
const createWindow = makeRateWindow(30, 60 * 60 * 1000);

interface LeanProduct {
  _id: mongoose.Types.ObjectId;
  name?: string;
  description?: string;
  images?: string[];
  price?: number;
  vendorId?: string;
  categorySlugs?: string[];
  slot?: string;
  stock?: number;
  cutoutUrl?: string;
  dimensionsCm?: { w?: number; h?: number; d?: number };
  placement?: { zone?: string; layer?: number };
  status?: string;
  source?: string;
  pausedBy?: string;
  submittedAt?: Date;
  approvedAt?: Date;
  reviewNote?: string;
}

function currentVendorId(req: Request): string | null {
  const { vendorId } = (req as any).currentUser as CurrentUser;
  return typeof vendorId === "string" && vendorId ? vendorId : null;
}

const NO_PROFILE = { message: "Your account is not linked to a vendor profile." };

export function toProductView(doc: LeanProduct, types: Map<string, ProductType>) {
  const images = (doc.images ?? []).filter(Boolean);
  const imageUrl = images[0] ?? doc.cutoutUrl ?? null;
  const type = types.get(doc.slot ?? "");
  const dims = doc.dimensionsCm;
  return {
    id: String(doc._id),
    name: doc.name ?? "",
    description: doc.description ?? "",
    slot: doc.slot ?? OTHER_TYPE_ID,
    typeLabel: type?.label ?? (doc.slot ?? "Other"),
    icon: type?.icon ?? "📦",
    price: doc.price ?? 0,
    stock: typeof doc.stock === "number" ? doc.stock : null,
    dimensionsCm: dims && typeof dims.w === "number" && typeof dims.h === "number" ? { w: dims.w, h: dims.h, d: dims.d ?? null } : null,
    status: effectiveStatus(doc.status),
    pausedBy: doc.pausedBy ?? null,
    reviewNote: doc.reviewNote ?? "",
    hasPhoto: Boolean(imageUrl),
    imageUrl,
    inRooms: (doc.categorySlugs ?? []).length > 0,
    createdByVendor: doc.source === "vendor",
    submittedAt: doc.submittedAt ?? null,
    approvedAt: doc.approvedAt ?? null,
    createdAt: doc._id.getTimestamp(),
  };
}

async function statusCounts(vendorId: string): Promise<Record<ProductStatus, number>> {
  const grouped: { _id: string | null; n: number }[] = await Essentials.aggregate([
    { $match: { vendorId } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  const counts: Record<ProductStatus, number> = { pending: 0, live: 0, paused: 0, rejected: 0 };
  for (const row of grouped) counts[effectiveStatus(row._id)] += row.n;
  return counts;
}

function productFilterForStatus(status: string): Record<string, unknown> | null {
  if (status === "all") return {};
  if (status === "live") return { status: { $nin: NOT_PUBLIC_PRODUCT_STATUSES } };
  if (status === "pending" || status === "paused" || status === "rejected") return { status };
  return null;
}

// --- GET /vendor/products/options: the product types a vendor can pick, and the limits the form shows
router.get("/options", async (_req: Request, res: Response) => {
  try {
    const types = await loadProductTypes();
    return res.json({
      types: Array.from(types.values()).map(({ id, label, icon }) => ({ id, label, icon })),
      maxProducts: MAX_PRODUCTS_PER_VENDOR,
    });
  } catch (error) {
    console.error("Failed to load product types:", error);
    return res.status(500).json({ message: "We could not load the product types. Please try again." });
  }
});

// --- GET /vendor/products?status=&before=&limit=
router.get("/", async (req: Request, res: Response) => {
  try {
    const vendorId = currentVendorId(req);
    if (!vendorId) return res.status(403).json(NO_PROFILE);

    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const statusFilter = productFilterForStatus(status);
    if (!statusFilter) return res.status(400).json({ message: "Unknown status" });
    const before = typeof req.query.before === "string" ? req.query.before : "";
    if (before && !mongoose.isValidObjectId(before)) return res.status(400).json({ message: "Invalid page marker" });
    const rawLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : DEFAULT_PAGE_SIZE;
    const limit = Number.isInteger(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

    const filter: Record<string, unknown> = { vendorId, ...statusFilter };
    if (before) filter._id = { $lt: new mongoose.Types.ObjectId(before) };

    const [page, types, counts] = await Promise.all([
      Essentials.find(filter).sort({ _id: -1 }).limit(limit + 1).lean() as unknown as Promise<LeanProduct[]>,
      loadProductTypes(),
      statusCounts(vendorId),
    ]);
    const hasMore = page.length > limit;
    const rows = page.slice(0, limit);
    return res.json({
      products: rows.map((doc) => toProductView(doc, types)),
      nextCursor: hasMore ? String(rows[rows.length - 1]._id) : null,
      counts,
    });
  } catch (error) {
    console.error("Failed to list vendor products:", error);
    return res.status(500).json({ message: "We could not load your products. Please try again." });
  }
});

// --- POST /vendor/products: add a product (it starts "pending")
router.post("/", async (req: Request, res: Response) => {
  try {
    const vendorId = currentVendorId(req);
    if (!vendorId) return res.status(403).json(NO_PROFILE);

    const types = await loadProductTypes();
    const parsed = parseProductInput(req.body, { mode: "create", allowedTypes: new Set(types.keys()) });
    if (!parsed.ok) {
      return res.status(400).json({ message: "Please check the details and try again.", errors: parsed.errors });
    }

    const owned = await Essentials.countDocuments({ vendorId, status: { $ne: "rejected" } });
    if (owned >= MAX_PRODUCTS_PER_VENDOR) {
      return res.status(409).json({ message: `You have reached the limit of ${MAX_PRODUCTS_PER_VENDOR} products.` });
    }
    if (!createWindow.take(vendorId)) {
      return res.status(429).json({ message: "You are adding products very quickly. Please wait a few minutes and try again." });
    }

    const { name, description, slot, price, stock, dimensionsCm } = parsed.fields;
    const created = await Essentials.create({
      name,
      ...(description ? { description } : {}),
      slot,
      price,
      ...(typeof stock === "number" ? { stock } : {}),
      ...(dimensionsCm ? { dimensionsCm } : {}),
      vendorId,
      images: [],
      categorySlugs: [],
      purchaseMode: "on-platform",
      status: "pending",
      source: "vendor",
      submittedAt: new Date(),
    });
    return res.status(201).json({ product: toProductView(created.toObject() as unknown as LeanProduct, types), warnings: parsed.warnings });
  } catch (error) {
    console.error("Failed to add product:", error);
    return res.status(500).json({ message: "We could not save your product. Please try again." });
  }
});

// --- GET /vendor/products/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const vendorId = currentVendorId(req);
    if (!vendorId) return res.status(403).json(NO_PROFILE);
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const [doc, types] = await Promise.all([
      Essentials.findOne({ _id: req.params.id, vendorId }).lean() as unknown as Promise<LeanProduct | null>,
      loadProductTypes(),
    ]);
    if (!doc) return res.status(404).json({ message: "Product not found" });
    return res.json({ product: toProductView(doc, types) });
  } catch (error) {
    console.error("Failed to load product:", error);
    return res.status(500).json({ message: "We could not load this product. Please try again." });
  }
});

// --- PATCH /vendor/products/:id: change any of name, description, type, price, stock, size
// Price and stock changes are live at once. A rejected product that is edited goes back to review.
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const vendorId = currentVendorId(req);
    if (!vendorId) return res.status(403).json(NO_PROFILE);
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Product not found" });

    const [existing, types] = await Promise.all([
      Essentials.findOne({ _id: req.params.id, vendorId }).lean() as unknown as Promise<LeanProduct | null>,
      loadProductTypes(),
    ]);
    if (!existing) return res.status(404).json({ message: "Product not found" });

    const parsed = parseProductInput(req.body, {
      mode: "update",
      allowedTypes: new Set(types.keys()),
      existing: { slot: existing.slot, cutoutUrl: existing.cutoutUrl ?? null, placement: existing.placement ?? null },
    });
    if (!parsed.ok) {
      return res.status(400).json({ message: "Please check the details and try again.", errors: parsed.errors });
    }

    const set: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};
    const { name, description, slot, price, stock, dimensionsCm } = parsed.fields;
    if (name !== undefined) set.name = name;
    if (description !== undefined) {
      if (description) set.description = description;
      else unset.description = "";
    }
    if (slot !== undefined) {
      set.slot = slot;
      // A different type no longer fits the rooms the product was in: it leaves them until the owner adds it again.
      if (slot !== existing.slot) set.categorySlugs = [];
    }
    if (price !== undefined) set.price = price;
    if (stock !== undefined) {
      if (stock === null) unset.stock = "";
      else set.stock = stock;
    }
    if (dimensionsCm !== undefined) {
      if (dimensionsCm === null) unset.dimensionsCm = "";
      else set.dimensionsCm = dimensionsCm;
    }
    if (existing.status === "rejected") {
      set.status = "pending";
      set.submittedAt = new Date();
      unset.reviewNote = "";
      unset.reviewedAt = "";
    }

    const update: Record<string, unknown> = {};
    if (Object.keys(set).length > 0) update.$set = set;
    if (Object.keys(unset).length > 0) update.$unset = unset;
    const updated = (await Essentials.findOneAndUpdate({ _id: req.params.id, vendorId }, update, {
      new: true,
      lean: true,
    })) as unknown as LeanProduct | null;
    if (!updated) return res.status(404).json({ message: "Product not found" });
    return res.json({ product: toProductView(updated, types), warnings: parsed.warnings });
  } catch (error) {
    console.error("Failed to update product:", error);
    return res.status(500).json({ message: "We could not save your changes. Please try again." });
  }
});

// --- POST /vendor/products/:id/pause: take a live product off sale (atomic: only a live one can be paused)
router.post("/:id/pause", async (req: Request, res: Response) => {
  try {
    const vendorId = currentVendorId(req);
    if (!vendorId) return res.status(403).json(NO_PROFILE);
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const updated = (await Essentials.findOneAndUpdate(
      { _id: req.params.id, vendorId, status: { $nin: NOT_PUBLIC_PRODUCT_STATUSES } },
      { $set: { status: "paused", pausedBy: "vendor" } },
      { new: true, lean: true },
    )) as unknown as LeanProduct | null;
    if (!updated) return stateConflict(req, res, vendorId, "Only a live product can be paused.");
    return res.json({ product: toProductView(updated, await loadProductTypes()) });
  } catch (error) {
    console.error("Failed to pause product:", error);
    return res.status(500).json({ message: "We could not pause this product. Please try again." });
  }
});

// --- POST /vendor/products/:id/resume: put a product the vendor paused back on sale (not one the owner paused)
router.post("/:id/resume", async (req: Request, res: Response) => {
  try {
    const vendorId = currentVendorId(req);
    if (!vendorId) return res.status(403).json(NO_PROFILE);
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const updated = (await Essentials.findOneAndUpdate(
      { _id: req.params.id, vendorId, status: "paused", pausedBy: "vendor" },
      { $set: { status: "live" }, $unset: { pausedBy: "" } },
      { new: true, lean: true },
    )) as unknown as LeanProduct | null;
    if (!updated) {
      const current = (await Essentials.findOne({ _id: req.params.id, vendorId }, { status: 1, pausedBy: 1 }).lean()) as unknown as LeanProduct | null;
      if (!current) return res.status(404).json({ message: "Product not found" });
      if (current.status === "paused" && current.pausedBy === "admin") {
        return res.status(409).json({ message: "Go Renovate paused this product. Please contact us to put it back on sale." });
      }
      return res.status(409).json({ message: "Only a product you paused can be put back on sale." });
    }
    return res.json({ product: toProductView(updated, await loadProductTypes()) });
  } catch (error) {
    console.error("Failed to resume product:", error);
    return res.status(500).json({ message: "We could not put this product back on sale. Please try again." });
  }
});

// --- POST /vendor/products/:id/duplicate: a copy (for another colour or size) that goes to review
router.post("/:id/duplicate", async (req: Request, res: Response) => {
  try {
    const vendorId = currentVendorId(req);
    if (!vendorId) return res.status(403).json(NO_PROFILE);
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const source = (await Essentials.findOne({ _id: req.params.id, vendorId }).lean()) as unknown as LeanProduct | null;
    if (!source) return res.status(404).json({ message: "Product not found" });

    const owned = await Essentials.countDocuments({ vendorId, status: { $ne: "rejected" } });
    if (owned >= MAX_PRODUCTS_PER_VENDOR) {
      return res.status(409).json({ message: `You have reached the limit of ${MAX_PRODUCTS_PER_VENDOR} products.` });
    }
    if (!createWindow.take(vendorId)) {
      return res.status(429).json({ message: "You are adding products very quickly. Please wait a few minutes and try again." });
    }

    // Only the facts a vendor typed are copied: not the photos, cut-out, 3D model, rooms or review history.
    const suffix = " (copy)";
    const name = `${(source.name ?? "").slice(0, 100 - suffix.length)}${suffix}`;
    const copy = await Essentials.create({
      name,
      ...(source.description ? { description: source.description } : {}),
      slot: source.slot,
      price: source.price,
      ...(typeof source.stock === "number" ? { stock: source.stock } : {}),
      ...(source.dimensionsCm?.w && source.dimensionsCm?.h ? { dimensionsCm: source.dimensionsCm } : {}),
      vendorId,
      images: [],
      categorySlugs: [],
      purchaseMode: "on-platform",
      status: "pending",
      source: "vendor",
      submittedAt: new Date(),
    });
    return res.status(201).json({ product: toProductView(copy.toObject() as unknown as LeanProduct, await loadProductTypes()) });
  } catch (error) {
    console.error("Failed to duplicate product:", error);
    return res.status(500).json({ message: "We could not copy this product. Please try again." });
  }
});

// The product exists for this vendor but is in the wrong state for the action (409), or it is not theirs (404).
async function stateConflict(req: Request, res: Response, vendorId: string, message: string) {
  const current = await Essentials.findOne({ _id: req.params.id, vendorId }, { _id: 1 }).lean();
  if (!current) return res.status(404).json({ message: "Product not found" });
  return res.status(409).json({ message });
}

export default router;
