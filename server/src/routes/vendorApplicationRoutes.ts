import express, { Request, Response, Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/authMiddleware";
import { CurrentUser, loadCurrentUser, requireRole } from "../middleware/requireRole";
import { SELLS_OPTIONS, VendorApplications } from "../models/vendorApplicationModel";
import { VendorDetails } from "../models/vendorDetailModel";
import { Users } from "../models/userModels";

// "Sell on Go Renovate": a signed-in customer applies, an admin approves or rejects.
// Approving creates a NEW vendor profile (never a seeded one) and makes the applicant a vendor.
// The role and vendorId are only ever set here, by the server, never copied from a request body.
const router: Router = express.Router();
router.use(requireAuth);

const MAX_REASON_LENGTH = 300;
const GST_MESSAGE = "That GST number does not look right. Leave it empty if you do not have one.";
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

// Accepts 10-digit Indian mobiles with an optional +91 / 91 / 0 prefix; stores the 10 digits.
function indianMobile(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[\s-]/g, "");
  const match = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(digits);
  return match ? match[1] : null;
}

function validateApplication(body: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const businessName = text(body.businessName, 2, 80);
  if (!businessName) errors.businessName = "Enter your business name (2 to 80 characters).";
  const city = text(body.city, 2, 60);
  if (!city) errors.city = "Enter the city you work from.";
  const sells = typeof body.sells === "string" ? body.sells : "";
  if (!(SELLS_OPTIONS as readonly string[]).includes(sells)) {
    errors.sells = "Choose whether you offer services, products or both.";
  }
  const phone = indianMobile(body.phone);
  if (!phone) errors.phone = "Enter a 10-digit Indian mobile number.";
  const pickupAddress = text(body.pickupAddress, 10, 300);
  if (!pickupAddress) errors.pickupAddress = "Enter your address (at least 10 characters).";

  let gstin = "";
  if (typeof body.gstin === "string") {
    gstin = body.gstin.trim().toUpperCase();
    if (gstin !== "" && !GSTIN_PATTERN.test(gstin)) errors.gstin = GST_MESSAGE;
  } else if (body.gstin !== undefined && body.gstin !== null) {
    errors.gstin = GST_MESSAGE;
  }

  return { errors, values: { businessName, city, sells, phone, pickupAddress, gstin } };
}

function publicApplication(doc: any) {
  return {
    id: String(doc._id),
    businessName: doc.businessName,
    city: doc.city,
    sells: doc.sells,
    phone: doc.phone,
    pickupAddress: doc.pickupAddress,
    gstin: doc.gstin || "",
    status: doc.status,
    rejectionReason: doc.rejectionReason || "",
    vendorId: doc.vendorId ?? null,
    createdAt: doc.createdAt,
    decidedAt: doc.decidedAt ?? null,
  };
}

// Some older accounts store their numeric userId as text. A normal Mongoose query casts the id to a
// number and would miss them, so find the row with the raw driver, then load the full document.
async function findUserDocument(userId: number) {
  const raw = await Users.collection.findOne({ userId: { $in: [userId, String(userId)] } } as any, { projection: { _id: 1 } });
  return raw ? Users.findById(raw._id) : null;
}

// Apply to sell.
router.post("/", async (req: Request, res: Response) => {
  try {
    const current = await loadCurrentUser(req);
    if (!current) return res.status(401).json({ message: "Invalid session" });
    if (current.role === "admin") {
      return res.status(403).json({ message: "Admin accounts cannot apply to sell." });
    }
    if (current.role === "vendor") {
      return res.status(409).json({ message: "Your account is already a vendor." });
    }

    const { errors, values } = validateApplication(req.body ?? {});
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: "Please fix the highlighted fields.", errors });
    }

    const open = await VendorApplications.findOne({ userId: current.userId, status: "pending" });
    if (open) {
      return res.status(409).json({ message: "You already have an application waiting for review." });
    }

    const created = await VendorApplications.create({
      ...values,
      userId: current.userId,
      userEmail: current.userEmail,
    });
    return res.status(201).json({ application: publicApplication(created) });
  } catch (error) {
    console.error("Failed to submit vendor application:", error);
    return res.status(500).json({ message: "We could not submit your application. Please try again." });
  }
});

// The signed-in user's latest application (null if they never applied).
router.get("/mine", async (req: Request, res: Response) => {
  try {
    const current = await loadCurrentUser(req);
    if (!current) return res.status(401).json({ message: "Invalid session" });
    const latest = await VendorApplications.findOne({ userId: current.userId }).sort({ createdAt: -1 });
    return res.json({ application: latest ? publicApplication(latest) : null });
  } catch (error) {
    console.error("Failed to load vendor application:", error);
    return res.status(500).json({ message: "We could not load your application. Please try again." });
  }
});

// ---- admin only from here ----

router.get("/", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const wanted = typeof req.query.status === "string" ? req.query.status : "pending";
    const filter = ["pending", "approved", "rejected"].includes(wanted) ? { status: wanted } : {};
    const applications = await VendorApplications.find(filter).sort({ createdAt: 1 }).limit(200);
    return res.json({
      applications: applications.map((doc) => ({ ...publicApplication(doc), userEmail: doc.userEmail })),
    });
  } catch (error) {
    console.error("Failed to list vendor applications:", error);
    return res.status(500).json({ message: "Could not load applications. Please try again." });
  }
});

router.post("/:id/approve", requireRole("admin"), async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ message: "Application not found" });

  let claimed: any = null;
  let createdVendorId: string | null = null;
  try {
    // Claim it first so two clicks (or two admins) cannot approve the same application twice.
    claimed = await VendorApplications.findOneAndUpdate(
      { _id: id, status: "pending" },
      { status: "approved", decidedAt: new Date() },
      { new: true },
    );
    if (!claimed) {
      const exists = await VendorApplications.exists({ _id: id });
      return res
        .status(exists ? 409 : 404)
        .json({ message: exists ? "This application was already decided." : "Application not found" });
    }

    const user = await findUserDocument(claimed.userId);
    if (!user || user.get("role") === "vendor") {
      await VendorApplications.updateOne({ _id: id }, { status: "pending", $unset: { decidedAt: 1 } });
      return res.status(409).json({
        message: user ? "The applicant is already a vendor." : "The applicant's account no longer exists.",
      });
    }

    const vendorId = `v-${claimed._id}`;
    await VendorDetails.create({
      id: vendorId,
      name: claimed.businessName,
      tagline: "",
      // A new vendor starts with no track record. Only the server/admin may ever change these.
      rating: 0,
      reviewCount: 0,
      completedProjects: 0,
      yearsActive: 0,
      location: claimed.city,
      responseTime: "",
      verified: false,
      badges: [],
      categories: [],
      status: "active",
      source: "application",
      ownerUserId: claimed.userId,
      approvedAt: new Date(),
    });
    createdVendorId = vendorId;

    user.set("role", "vendor");
    user.set("vendorId", vendorId);
    await user.save();
    await VendorApplications.updateOne({ _id: id }, { vendorId });

    return res.json({ application: publicApplication({ ...claimed.toObject(), vendorId }) });
  } catch (error) {
    console.error("Failed to approve vendor application:", error);
    // Undo whatever got done so the application can be approved again.
    try {
      if (createdVendorId) await VendorDetails.deleteOne({ id: createdVendorId, source: "application" });
      if (claimed) await VendorApplications.updateOne({ _id: id }, { status: "pending", $unset: { decidedAt: 1 } });
    } catch (undoError) {
      console.error("Could not undo a failed approval:", undoError);
    }
    return res.status(500).json({ message: "Could not approve this application. Please try again." });
  }
});

router.post("/:id/reject", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ message: "Application not found" });
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, MAX_REASON_LENGTH) : "";

    const rejected = await VendorApplications.findOneAndUpdate(
      { _id: id, status: "pending" },
      { status: "rejected", rejectionReason: reason, decidedAt: new Date() },
      { new: true },
    );
    if (!rejected) {
      const exists = await VendorApplications.exists({ _id: id });
      return res
        .status(exists ? 409 : 404)
        .json({ message: exists ? "This application was already decided." : "Application not found" });
    }
    return res.json({ application: publicApplication(rejected) });
  } catch (error) {
    console.error("Failed to reject vendor application:", error);
    return res.status(500).json({ message: "Could not reject this application. Please try again." });
  }
});

// Owner-only testing shortcut: attach one of your own test accounts to a DEMO (seeded) vendor so the
// vendor side can be tried without applying. Refuses real vendors created through sign-up.
router.post("/admin/link", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const userId = Number(req.body?.userId);
    const vendorId = typeof req.body?.vendorId === "string" ? req.body.vendorId.trim() : "";
    if (!Number.isInteger(userId) || !vendorId) {
      return res.status(400).json({ message: "userId (a number) and vendorId are required." });
    }

    const vendor = await VendorDetails.findOne({ id: vendorId });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    if (vendor.get("source") === "application") {
      return res.status(409).json({ message: "Real vendors cannot be linked by hand." });
    }
    const owner = vendor.get("ownerUserId");
    if (owner != null && owner !== userId) {
      return res.status(409).json({ message: "That vendor already belongs to another account." });
    }

    const user = await findUserDocument(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const admin = (req as any).currentUser as CurrentUser;
    if (admin.userId === userId) {
      return res.status(409).json({ message: "Use a separate test account, not your admin account." });
    }
    if (user.get("role") === "vendor" && user.get("vendorId") !== vendorId) {
      return res.status(409).json({ message: "That account is already linked to another vendor." });
    }

    user.set("role", "vendor");
    user.set("vendorId", vendorId);
    await user.save();
    vendor.set("ownerUserId", userId);
    await vendor.save();
    return res.json({ ok: true, userId, vendorId });
  } catch (error) {
    console.error("Failed to link test vendor:", error);
    return res.status(500).json({ message: "Could not link that account. Please try again." });
  }
});

router.post("/admin/unlink", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const userId = Number(req.body?.userId);
    if (!Number.isInteger(userId)) return res.status(400).json({ message: "userId (a number) is required." });

    const user = await findUserDocument(userId);
    if (!user || user.get("role") !== "vendor") {
      return res.status(404).json({ message: "That account is not linked to a vendor." });
    }
    const vendor = await VendorDetails.findOne({ id: user.get("vendorId") });
    if (vendor?.get("source") === "application") {
      return res.status(409).json({ message: "Real vendors cannot be unlinked by hand." });
    }

    user.set("role", "customer");
    user.set("vendorId", null);
    await user.save();
    if (vendor && vendor.get("ownerUserId") === userId) {
      vendor.set("ownerUserId", null);
      await vendor.save();
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error("Failed to unlink test vendor:", error);
    return res.status(500).json({ message: "Could not unlink that account. Please try again." });
  }
});

export default router;
