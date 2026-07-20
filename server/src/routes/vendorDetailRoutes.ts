import express, { Request, Response, Router } from "express";
import { VendorDetails } from "../models/vendorDetailModel";

const router: Router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const vendors = await VendorDetails.find({});
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
