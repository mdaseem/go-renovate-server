import express, { Request, Response, Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/authMiddleware";
import { requireRole } from "../middleware/requireRole";
import { Essentials } from "../models/essentialModel";
import { effectiveStatus, NOT_PUBLIC_PRODUCT_STATUSES, ProductStatus } from "../services/productVisibility";
import { loadProductTypes, OTHER_TYPE_ID } from "../services/productTypes";
import { parseReason } from "../services/vendorProductRules";
import { getVendorNameMap } from "../services/vendorNameLookup";
import { toProductView } from "./vendorProductRoutes";

// The owner's review of products vendors created: approve (optionally also show it in the room
// designer), reject with a reason, pause or resume any vendor product, and switch rooms on or off.
// Admin-only (ADMIN_EMAILS). These routes only ever touch products created by vendors (`source: "vendor"`),
// never the seeded catalogue.
const router: Router = express.Router();
router.use(requireAuth, requireRole("admin"));

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;
const VENDOR_ONLY = { source: "vendor" } as const;

function adminView(doc: any, types: Awaited<ReturnType<typeof loadProductTypes>>, vendorNames: Map<string, string>) {
  return {
    ...toProductView(doc, types),
    vendorId: doc.vendorId as string,
    vendorName: vendorNames.get(doc.vendorId as string) ?? "Unknown vendor",
    // Rooms the product could be shown in, by its type (empty for "Other").
    possibleRooms: types.get(doc.slot)?.rooms ?? [],
  };
}

async function respondWith(res: Response, doc: any, status = 200) {
  const types = await loadProductTypes();
  const names = await getVendorNameMap([doc.vendorId as string]);
  return res.status(status).json({ product: adminView(doc, types, names) });
}

async function counts(): Promise<Record<ProductStatus, number>> {
  const grouped: { _id: string | null; n: number }[] = await Essentials.aggregate([
    { $match: VENDOR_ONLY },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  const result: Record<ProductStatus, number> = { pending: 0, live: 0, paused: 0, rejected: 0 };
  for (const row of grouped) result[effectiveStatus(row._id)] += row.n;
  return result;
}

// --- GET /admin/products?status=pending|live|paused|rejected&before=&limit=   (default: pending)
router.get("/", async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "pending";
    if (!["pending", "live", "paused", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Unknown status" });
    }
    const before = typeof req.query.before === "string" ? req.query.before : "";
    if (before && !mongoose.isValidObjectId(before)) return res.status(400).json({ message: "Invalid page marker" });
    const rawLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : DEFAULT_PAGE_SIZE;
    const limit = Number.isInteger(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

    const filter: Record<string, unknown> = { ...VENDOR_ONLY, status };
    if (before) filter._id = { $lt: new mongoose.Types.ObjectId(before) };
    // Oldest waiting first for the review queue, newest first elsewhere.
    const sortDir = status === "pending" ? 1 : -1;
    if (before && status === "pending") filter._id = { $gt: new mongoose.Types.ObjectId(before) };

    const [page, types, totals] = await Promise.all([
      Essentials.find(filter).sort({ _id: sortDir }).limit(limit + 1).lean(),
      loadProductTypes(),
      counts(),
    ]);
    const hasMore = page.length > limit;
    const rows = page.slice(0, limit);
    const names = await getVendorNameMap(rows.map((row) => row.vendorId as string));
    return res.json({
      products: rows.map((row) => adminView(row, types, names)),
      nextCursor: hasMore ? String(rows[rows.length - 1]._id) : null,
      counts: totals,
    });
  } catch (error) {
    console.error("Failed to list products for review:", error);
    return res.status(500).json({ message: "We could not load the products. Please try again." });
  }
});

// Atomic claim of a state change on a vendor-created product; null when it was not in an allowed state.
async function claim(
  id: string,
  fromStatuses: string[],
  set: Record<string, unknown>,
  unset: Record<string, ""> = {},
  extraFilter: Record<string, unknown> = {},
) {
  const update: Record<string, unknown> = { $set: set };
  if (Object.keys(unset).length > 0) update.$unset = unset;
  return Essentials.findOneAndUpdate({ _id: id, ...VENDOR_ONLY, status: { $in: fromStatuses }, ...extraFilter }, update, {
    new: true,
    lean: true,
  });
}

async function notFoundOrConflict(res: Response, id: string, message: string) {
  const exists = await Essentials.exists({ _id: id, ...VENDOR_ONLY });
  if (!exists) return res.status(404).json({ message: "Product not found" });
  return res.status(409).json({ message });
}

const validId = (id: string) => mongoose.isValidObjectId(id);

// --- POST /admin/products/:id/approve  { showInRooms?: boolean }   pending -> live
router.post("/:id/approve", async (req: Request, res: Response) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const showInRooms = req.body?.showInRooms === true;
    // A product needs at least one photo to go live (photo upload shipped 2026-10-24).
    const waiting = (await Essentials.findOne({ _id: req.params.id, ...VENDOR_ONLY, status: "pending" }, { images: 1 }).lean()) as { images?: string[] } | null;
    if (waiting && (waiting.images ?? []).filter(Boolean).length === 0) {
      return res.status(409).json({ message: "This product has no photo yet. Ask the vendor to add one before approving." });
    }
    const set: Record<string, unknown> = { status: "live", approvedAt: new Date(), reviewedAt: new Date() };
    if (showInRooms) {
      const product = (await Essentials.findOne({ _id: req.params.id, ...VENDOR_ONLY, status: "pending" }, { slot: 1 }).lean()) as { slot?: string } | null;
      const rooms = (await loadProductTypes()).get(product?.slot ?? OTHER_TYPE_ID)?.rooms ?? [];
      if (product && rooms.length === 0) {
        return res.status(400).json({ message: "This product type cannot be shown in rooms.", errors: { showInRooms: "Products of type Other cannot be shown in rooms." } });
      }
      set.categorySlugs = rooms;
    }
    // The photo condition is repeated in the claim so a photo removed at the same moment cannot slip through.
    const updated = await claim(req.params.id, ["pending"], set, { reviewNote: "" }, { "images.0": { $exists: true } });
    if (!updated) return notFoundOrConflict(res, req.params.id, "This product is not waiting for review, or its photo was just removed.");
    return respondWith(res, updated);
  } catch (error) {
    console.error("Failed to approve product:", error);
    return res.status(500).json({ message: "We could not approve this product. Please try again." });
  }
});

// --- POST /admin/products/:id/reject  { reason }   pending -> rejected
router.post("/:id/reject", async (req: Request, res: Response) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const reason = parseReason(req.body?.reason);
    if (!reason.ok) return res.status(400).json({ message: reason.error, errors: { reason: reason.error } });
    const updated = await claim(req.params.id, ["pending"], { status: "rejected", reviewNote: reason.reason, reviewedAt: new Date() });
    if (!updated) return notFoundOrConflict(res, req.params.id, "This product is not waiting for review.");
    return respondWith(res, updated);
  } catch (error) {
    console.error("Failed to reject product:", error);
    return res.status(500).json({ message: "We could not reject this product. Please try again." });
  }
});

// --- POST /admin/products/:id/pause   live -> paused (by the owner: the vendor cannot undo it)
router.post("/:id/pause", async (req: Request, res: Response) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const updated = await Essentials.findOneAndUpdate(
      { _id: req.params.id, ...VENDOR_ONLY, status: { $nin: NOT_PUBLIC_PRODUCT_STATUSES } },
      { $set: { status: "paused", pausedBy: "admin" } },
      { new: true, lean: true },
    );
    if (!updated) return notFoundOrConflict(res, req.params.id, "Only a live product can be paused.");
    return respondWith(res, updated);
  } catch (error) {
    console.error("Failed to pause product:", error);
    return res.status(500).json({ message: "We could not pause this product. Please try again." });
  }
});

// --- POST /admin/products/:id/resume   paused -> live (whoever paused it)
router.post("/:id/resume", async (req: Request, res: Response) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const updated = await claim(req.params.id, ["paused"], { status: "live" }, { pausedBy: "" });
    if (!updated) return notFoundOrConflict(res, req.params.id, "Only a paused product can be put back on sale.");
    return respondWith(res, updated);
  } catch (error) {
    console.error("Failed to resume product:", error);
    return res.status(500).json({ message: "We could not put this product back on sale. Please try again." });
  }
});

// --- POST /admin/products/:id/rooms  { enabled: boolean }   show the product in its type's rooms, or take it out
router.post("/:id/rooms", async (req: Request, res: Response) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    if (typeof req.body?.enabled !== "boolean") {
      return res.status(400).json({ message: "Say whether to show it in rooms.", errors: { enabled: "Choose on or off." } });
    }
    const existing = (await Essentials.findOne({ _id: req.params.id, ...VENDOR_ONLY, status: { $in: ["live", "paused"] } }, { slot: 1 }).lean()) as { slot?: string } | null;
    if (!existing) return notFoundOrConflict(res, req.params.id, "Approve the product before putting it in rooms.");
    const rooms = req.body.enabled ? (await loadProductTypes()).get(existing.slot ?? OTHER_TYPE_ID)?.rooms ?? [] : [];
    if (req.body.enabled && rooms.length === 0) {
      return res.status(400).json({ message: "This product type cannot be shown in rooms.", errors: { enabled: "Products of type Other cannot be shown in rooms." } });
    }
    const updated = await Essentials.findOneAndUpdate(
      { _id: req.params.id, ...VENDOR_ONLY, status: { $in: ["live", "paused"] } },
      { $set: { categorySlugs: rooms } },
      { new: true, lean: true },
    );
    if (!updated) return res.status(404).json({ message: "Product not found" });
    return respondWith(res, updated);
  } catch (error) {
    console.error("Failed to change rooms for product:", error);
    return res.status(500).json({ message: "We could not change that. Please try again." });
  }
});

export default router;
