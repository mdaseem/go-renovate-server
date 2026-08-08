import express, { Request, Response, Router } from "express";
import { FilterQuery } from "mongoose";
import { VendorDetails } from "../models/vendorDetailModel";

const router: Router = express.Router();

function parseMultiValue(value: unknown): string[] | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const values = value.split("|").filter(Boolean);
  return values.length > 0 ? values : undefined;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, location, rating, verified } = req.query;
    const filter: FilterQuery<typeof VendorDetails> = {};

    const categoryIds = parseMultiValue(category);
    if (categoryIds) {
      filter["categories.id"] = { $in: categoryIds };
    }

    const locations = parseMultiValue(location);
    if (locations) {
      filter.location = { $in: locations };
    }

    if (typeof rating === "string" && rating.length > 0) {
      const minRating = Number(rating);
      if (!Number.isNaN(minRating)) {
        filter.rating = { $gte: minRating };
      }
    }

    if (verified === "1") {
      filter.verified = true;
    }

    const vendors = await VendorDetails.find(filter);
    return res.json(vendors);
  } catch (error) {
    console.error("Failed to fetch vendors:", error);
    return res.status(500).json({ message: "Failed to fetch vendors" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const vendor = await VendorDetails.findOne({ id });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    return res.json(vendor);
  } catch (error) {
    console.error("Failed to fetch vendor detail:", error);
    return res.status(500).json({ message: "Failed to fetch vendor detail" });
  }
});

export default router;
