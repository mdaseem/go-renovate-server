import express, { Request, Response, Router } from "express";
import mongoose, { FilterQuery } from "mongoose";
import { Essentials } from "../models/essentialModel";
import { getVendorNameMap } from "../services/vendorNameLookup";

const router: Router = express.Router();

function parseMultiValue(value: unknown): string[] | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const values = value.split("|").filter(Boolean);
  return values.length > 0 ? values : undefined;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, slot, vendorId, minPrice, maxPrice, purchaseMode } =
      req.query;
    const filter: FilterQuery<typeof Essentials> = {};

    if (typeof category === "string" && category.length > 0) {
      filter.categorySlugs = category;
    }

    const slots = parseMultiValue(slot);
    if (slots) {
      filter.slot = { $in: slots };
    }

    const vendorIds = parseMultiValue(vendorId);
    if (vendorIds) {
      filter.vendorId = { $in: vendorIds };
    }

    const min = typeof minPrice === "string" ? Number(minPrice) : NaN;
    const max = typeof maxPrice === "string" ? Number(maxPrice) : NaN;
    if (!Number.isNaN(min) || !Number.isNaN(max)) {
      filter.price = {};
      if (!Number.isNaN(min)) filter.price.$gte = min;
      if (!Number.isNaN(max)) filter.price.$lte = max;
    }

    if (purchaseMode === "on-platform" || purchaseMode === "external-store") {
      filter.purchaseMode = purchaseMode;
    }

    const essentials = await Essentials.find(filter);
    const vendorNameById = await getVendorNameMap(
      essentials.map((essential) => essential.get("vendorId") as string),
    );
    const enriched = essentials.map((essential) => {
      const plain = essential.toObject() as Record<string, unknown>;
      plain.vendorName =
        vendorNameById.get(plain.vendorId as string) ?? "Unknown vendor";
      return plain;
    });
    return res.json(enriched);
  } catch (error) {
    console.error("Failed to fetch essentials:", error);
    return res.status(500).json({ message: "Failed to fetch essentials" });
  }
});

const MAX_AVAILABILITY_IDS = 50; // mirrors vendorDetailRoutes.ts's own cap

// Registered above the bare "/:id" route below — otherwise that route would
// swallow this one as id="availability" (same mount-order hazard already
// documented for /essentials/categories and /essentials/orders in index.ts).
router.get("/availability", async (req: Request, res: Response) => {
  try {
    const ids = parseMultiValue(req.query.ids);
    if (!ids) {
      return res.status(400).json({ message: "ids query parameter is required" });
    }
    if (ids.length > MAX_AVAILABILITY_IDS) {
      return res.status(400).json({
        message: `At most ${MAX_AVAILABILITY_IDS} ids can be checked at once`,
      });
    }

    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const found = await Essentials.find(
      { _id: { $in: validIds } },
      { price: 1, stock: 1, purchaseMode: 1 },
    );
    const docById = new Map(found.map((doc) => [doc._id.toString(), doc]));

    // Available = still in the catalog AND, for tracked on-platform items,
    // at least one unit in stock. `stock` is returned (null = untracked) so
    // the UI can distinguish "out of stock" from "removed" and warn on low
    // stock.
    const essentials = ids.map((id) => {
      const doc = docById.get(id);
      if (!doc) return { id, isAvailable: false, price: null, stock: null };
      const stock = doc.get("stock") as number | undefined;
      const isTracked =
        doc.get("purchaseMode") !== "external-store" && typeof stock === "number";
      return {
        id,
        isAvailable: !isTracked || (stock as number) > 0,
        price: doc.get("price") as number,
        stock: isTracked ? (stock as number) : null,
      };
    });
    return res.json({ essentials });
  } catch (error) {
    console.error("Failed to check essential availability:", error);
    return res.status(500).json({ message: "Failed to check essential availability" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid essential id" });
    }

    const essential = await Essentials.findById(req.params.id);
    if (!essential) {
      return res.status(404).json({ message: "Essential not found" });
    }
    return res.json(essential);
  } catch (error) {
    console.error("Failed to fetch essential:", error);
    return res.status(500).json({ message: "Failed to fetch essential" });
  }
});

export default router;
