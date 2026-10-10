import express, { Request, Response, Router } from "express";
import { Categories } from "../models/categoryModel";
import { Rooms } from "../models/roomModel";
import { Essentials } from "../models/essentialModel";
import { Spaces } from "../models/spaceModel";
import { getVendorNameMap } from "../services/vendorNameLookup";

const router: Router = express.Router();

function parseMultiValue(value: unknown): string[] | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const values = value.split("|").filter(Boolean);
  return values.length > 0 ? values : undefined;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const categories = await Categories.find().sort({ sortOrder: 1 });
    return res.json(categories);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return res.status(500).json({ message: "Failed to fetch categories" });
  }
});

router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const category = await Categories.findOne({ slug });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const { style, minPrice, maxPrice } = req.query;
    const roomFilter: Record<string, unknown> = { categorySlug: slug };

    const styles = parseMultiValue(style);
    if (styles) {
      roomFilter.styleTags = { $in: styles };
    }

    const min = typeof minPrice === "string" ? Number(minPrice) : NaN;
    const max = typeof maxPrice === "string" ? Number(maxPrice) : NaN;
    if (!Number.isNaN(min) || !Number.isNaN(max)) {
      const priceFilter: Record<string, number> = {};
      if (!Number.isNaN(min)) priceFilter.$gte = min;
      if (!Number.isNaN(max)) priceFilter.$lte = max;
      roomFilter.totalPrice = priceFilter;
    }

    const [rooms, essentials, spaces] = await Promise.all([
      Rooms.find(roomFilter),
      Essentials.find({ categorySlugs: slug }),
      // Selectable base layouts for the Customize preview, default first.
      Spaces.find({ categorySlug: slug }).sort({ isDefault: -1, sortOrder: 1 }),
    ]);

    const vendorNameById = await getVendorNameMap(
      essentials.map((essential) => essential.get("vendorId") as string),
    );

    const essentialsBySlot: Record<string, Record<string, unknown>[]> = {};
    for (const essential of essentials) {
      const plain = essential.toObject() as Record<string, unknown>;
      plain.vendorName =
        vendorNameById.get(plain.vendorId as string) ?? "Unknown vendor";
      const slot = plain.slot as string;
      if (!essentialsBySlot[slot]) essentialsBySlot[slot] = [];
      essentialsBySlot[slot].push(plain);
    }

    return res.json({ category, rooms, essentialsBySlot, spaces });
  } catch (error) {
    console.error("Failed to fetch category detail:", error);
    return res.status(500).json({ message: "Failed to fetch category detail" });
  }
});

export default router;
