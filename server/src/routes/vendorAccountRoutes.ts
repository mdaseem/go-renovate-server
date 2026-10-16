import express, { Request, Response, Router } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import { CurrentUser, requireRole } from "../middleware/requireRole";
import { VendorDetails } from "../models/vendorDetailModel";
import { presentVendors } from "../services/shopCatalogue";

// Routes for a signed-in vendor about their own business. Every route here is vendor-only and
// reads the vendorId from the database (via requireRole), never from the request.
const router: Router = express.Router();

router.get("/me", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
  try {
    const { vendorId } = (req as any).currentUser as CurrentUser;
    const vendor = vendorId ? await VendorDetails.findOne({ id: vendorId }, { ownerUserId: 0 }) : null;
    if (!vendor) {
      return res.status(404).json({ message: "We could not find your vendor profile." });
    }
    // In shop mode the "services" a vendor sees are their products, same as on the public pages.
    const [presented] = await presentVendors([vendor]);
    return res.json(presented);
  } catch (error) {
    console.error("Failed to load vendor profile:", error);
    return res.status(500).json({ message: "We could not load your profile. Please try again." });
  }
});

export default router;
