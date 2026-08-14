import express, { Request, Response, Router } from "express";
import { Users } from "../models/userModels";
import { VendorDetails } from "../models/vendorDetailModel";

const router: Router = express.Router();

// requireAuth sets req.user = decoded, and the token is signed as
// { name: userFound } (see authorizeUser.ts / orderRoutes.ts), so the
// actual user fields live one level down at req.user.name.
function getAuthedUserId(req: Request): number | undefined {
  const decoded = (req as any).user;
  return decoded?.name?.userId;
}

function requireAuthedUserId(
  req: Request,
  res: Response,
): number | undefined {
  const userId = getAuthedUserId(req);
  if (typeof userId !== "number") {
    res.status(401).json({ message: "Invalid session" });
    return undefined;
  }
  return userId;
}

// $in doesn't preserve the order of the ids passed to it, so hydrated
// results are re-sorted to match wishlist order — most recently added
// (last pushed by $addToSet) shown first.
async function hydrateWishlist(wishlist: string[]) {
  const vendors = await VendorDetails.find({ id: { $in: wishlist } });
  const order = new Map(wishlist.map((id, index) => [id, index]));
  return vendors.sort(
    (a, b) =>
      (order.get(b.get("id") as string) ?? 0) -
      (order.get(a.get("id") as string) ?? 0),
  );
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = requireAuthedUserId(req, res);
    if (userId === undefined) return;

    const user = await Users.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const vendors = await hydrateWishlist(user.wishlist || []);
    return res.json(vendors);
  } catch (error) {
    console.error("Failed to fetch wishlist:", error);
    return res.status(500).json({ message: "Failed to fetch wishlist" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = requireAuthedUserId(req, res);
    if (userId === undefined) return;

    const vendorId =
      typeof req.body?.vendorId === "string" ? req.body.vendorId.trim() : "";
    if (!vendorId) {
      return res.status(400).json({ message: "vendorId is required" });
    }

    const vendor = await VendorDetails.findOne({ id: vendorId });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const user = await Users.findOneAndUpdate(
      { userId },
      { $addToSet: { wishlist: vendorId } },
      { new: true },
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const vendors = await hydrateWishlist(user.wishlist || []);
    return res.json(vendors);
  } catch (error) {
    console.error("Failed to add to wishlist:", error);
    return res.status(500).json({ message: "Failed to add to wishlist" });
  }
});

router.delete("/:vendorId", async (req: Request, res: Response) => {
  try {
    const userId = requireAuthedUserId(req, res);
    if (userId === undefined) return;

    const { vendorId } = req.params;

    const user = await Users.findOneAndUpdate(
      { userId },
      { $pull: { wishlist: vendorId } },
      { new: true },
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const vendors = await hydrateWishlist(user.wishlist || []);
    return res.json(vendors);
  } catch (error) {
    console.error("Failed to remove from wishlist:", error);
    return res.status(500).json({ message: "Failed to remove from wishlist" });
  }
});

export default router;
