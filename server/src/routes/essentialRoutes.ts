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
