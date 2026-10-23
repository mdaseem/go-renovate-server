import express, { NextFunction, Request, Response, Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/authMiddleware";
import { CurrentUser, requireRole } from "../middleware/requireRole";
import { EssentialOrders } from "../models/essentialOrderModel";
import { Essentials } from "../models/essentialModel";
import {
  STAGE_STATUSES,
  VENDOR_ACTIONS,
  VENDOR_STAGES,
  VendorStage,
  parseVendorAction,
  stageOf,
} from "../services/vendorOrderRules";

// The vendor order inbox: a vendor sees only the orders that contain THEIR products and moves their own
// part through New -> Accepted -> Shipped -> Delivered (or declines / cancels with a reason).
// The vendor id always comes from the database (requireRole), never from the request, and a vendor is
// never sent another vendor's items, the order total, or the buyer's email or account id.
const router: Router = express.Router();
router.use(requireAuth, requireRole("vendor"));
// Delivery addresses and phone numbers: never cache these responses.
router.use((_req: Request, res: Response, next: NextFunction) => {
  res.set("Cache-Control", "no-store");
  next();
});

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

interface LeanItem {
  essentialId?: mongoose.Types.ObjectId;
  name?: string;
  price?: number;
  quantity?: number;
  imageUrl?: string;
}
interface LeanHistory {
  status: string;
  note?: string;
  changedAt: Date;
}
interface LeanVendorOrder {
  _id: mongoose.Types.ObjectId;
  vendorId: string;
  items?: LeanItem[];
  subtotal?: number;
  status: string;
  statusHistory?: LeanHistory[];
  shiprocket?: { courierName?: string; awbCode?: string; trackingUrl?: string } | null;
}
interface LeanOrder {
  _id: mongoose.Types.ObjectId;
  orderNumber: string;
  createdAt: Date;
  address?: {
    contactName?: string;
    phone?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  vendorOrders: LeanVendorOrder[];
}

function currentVendorId(req: Request): string | null {
  const { vendorId } = (req as any).currentUser as CurrentUser;
  return typeof vendorId === "string" && vendorId ? vendorId : null;
}

// What one vendor may see of an order. The list omits the street address and phone (the card only
// needs the city); the detail page, used to pack and ship, includes them.
function toView(order: LeanOrder, vendorId: string, detail: boolean) {
  const mine = order.vendorOrders.find((entry) => entry.vendorId === vendorId);
  if (!mine) return null;
  const items = (mine.items ?? []).map((item) => ({
    essentialId: item.essentialId ? String(item.essentialId) : null,
    name: item.name ?? "",
    price: item.price ?? 0,
    quantity: item.quantity ?? 0,
    imageUrl: item.imageUrl ?? null,
  }));
  const address = order.address ?? {};
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    status: mine.status,
    stage: stageOf(mine.status),
    subtotal: mine.subtotal ?? 0,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    items,
    delivery: detail
      ? {
          contactName: address.contactName ?? "",
          phone: address.phone ?? "",
          line1: address.line1 ?? "",
          line2: address.line2 ?? "",
          city: address.city ?? "",
          state: address.state ?? "",
          pincode: address.pincode ?? "",
        }
      : { city: address.city ?? "", state: address.state ?? "" },
    statusHistory: (mine.statusHistory ?? []).map((entry) => ({
      status: entry.status,
      note: entry.note ?? "",
      changedAt: entry.changedAt,
    })),
    shipment: mine.shiprocket
      ? {
          courierName: mine.shiprocket.courierName ?? "",
          trackingNumber: mine.shiprocket.awbCode ?? "",
          trackingUrl: mine.shiprocket.trackingUrl ?? "",
        }
      : null,
  };
}

async function stageCounts(vendorId: string): Promise<Record<VendorStage, number>> {
  const grouped: { _id: string; n: number }[] = await EssentialOrders.aggregate([
    { $match: { "vendorOrders.vendorId": vendorId } },
    { $unwind: "$vendorOrders" },
    { $match: { "vendorOrders.vendorId": vendorId } },
    { $group: { _id: "$vendorOrders.status", n: { $sum: 1 } } },
  ]);
  const counts: Record<VendorStage, number> = { new: 0, accepted: 0, shipped: 0, delivered: 0, closed: 0 };
  for (const row of grouped) counts[stageOf(row._id)] += row.n;
  return counts;
}

// Puts the stock reserved at checkout back after a decline/cancel. Only tracked, on-platform items were
// ever reserved. Runs once, by whichever request won the status change; failures are logged, not hidden.
async function releaseReservedStock(orderId: string, sub: LeanVendorOrder): Promise<void> {
  try {
    for (const item of sub.items ?? []) {
      if (!item.essentialId || !item.quantity) continue;
      await Essentials.updateOne(
        { _id: item.essentialId, purchaseMode: { $ne: "external-store" }, stock: { $type: "number" } },
        { $inc: { stock: item.quantity } },
      );
    }
    await EssentialOrders.updateOne(
      { _id: orderId, "vendorOrders._id": sub._id },
      { $set: { "vendorOrders.$.stockReleasedAt": new Date() } },
    );
  } catch (error) {
    console.error(`Failed to put stock back for order ${orderId} (vendor sub-order ${sub._id}):`, error);
  }
}

// --- GET /vendor/orders/summary: the counts behind the badge and the tabs (cheap, no order data)
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const vendorId = currentVendorId(req);
    if (!vendorId) return res.status(403).json({ message: "Your account is not linked to a vendor profile." });
    return res.json({ counts: await stageCounts(vendorId) });
  } catch (error) {
    console.error("Failed to load vendor order summary:", error);
    return res.status(500).json({ message: "We could not load your orders. Please try again." });
  }
});

// --- GET /vendor/orders?stage=&before=&limit=: newest first, paged by order id
router.get("/", async (req: Request, res: Response) => {
  try {
    const vendorId = currentVendorId(req);
    if (!vendorId) return res.status(403).json({ message: "Your account is not linked to a vendor profile." });

    const stage = typeof req.query.stage === "string" ? req.query.stage : "all";
    if (stage !== "all" && !(VENDOR_STAGES as string[]).includes(stage)) {
      return res.status(400).json({ message: "Unknown stage" });
    }
    const before = typeof req.query.before === "string" ? req.query.before : "";
    if (before && !mongoose.isValidObjectId(before)) {
      return res.status(400).json({ message: "Invalid page marker" });
    }
    const rawLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : DEFAULT_PAGE_SIZE;
    const limit = Number.isInteger(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

    const mineMatch: Record<string, unknown> = { vendorId };
    if (stage !== "all") mineMatch.status = { $in: STAGE_STATUSES[stage as VendorStage] };
    const filter: Record<string, unknown> = { vendorOrders: { $elemMatch: mineMatch } };
    if (before) filter._id = { $lt: new mongoose.Types.ObjectId(before) };

    const page = (await EssentialOrders.find(filter, {
      orderNumber: 1,
      createdAt: 1,
      "address.city": 1,
      "address.state": 1,
      vendorOrders: 1,
    })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()) as unknown as LeanOrder[];

    const hasMore = page.length > limit;
    const rows = page.slice(0, limit);
    const orders = rows
      .map((order) => toView(order, vendorId, false))
      .filter((view): view is NonNullable<typeof view> => view !== null);

    return res.json({
      orders,
      nextCursor: hasMore ? String(rows[rows.length - 1]._id) : null,
      counts: await stageCounts(vendorId),
    });
  } catch (error) {
    console.error("Failed to list vendor orders:", error);
    return res.status(500).json({ message: "We could not load your orders. Please try again." });
  }
});

// --- GET /vendor/orders/:orderId: one order, this vendor's part only, with the delivery details
router.get("/:orderId", async (req: Request, res: Response) => {
  try {
    const vendorId = currentVendorId(req);
    if (!vendorId) return res.status(403).json({ message: "Your account is not linked to a vendor profile." });
    if (!mongoose.isValidObjectId(req.params.orderId)) {
      return res.status(404).json({ message: "Order not found" });
    }
    const order = (await EssentialOrders.findOne(
      { _id: req.params.orderId, "vendorOrders.vendorId": vendorId },
      { orderNumber: 1, createdAt: 1, address: 1, vendorOrders: 1 },
    ).lean()) as unknown as LeanOrder | null;
    const view = order ? toView(order, vendorId, true) : null;
    if (!view) return res.status(404).json({ message: "Order not found" });
    return res.json({ order: view });
  } catch (error) {
    console.error("Failed to load vendor order:", error);
    return res.status(500).json({ message: "We could not load this order. Please try again." });
  }
});

// --- PATCH /vendor/orders/:orderId/status  { action, reason?, note?, courierName?, trackingNumber?, trackingUrl? }
// The change is claimed with ONE atomic update that also checks the current status, so a double tap or
// two open tabs cannot apply it twice, and an action that no longer fits answers 409.
router.patch("/:orderId/status", async (req: Request, res: Response) => {
  try {
    const vendorId = currentVendorId(req);
    if (!vendorId) return res.status(403).json({ message: "Your account is not linked to a vendor profile." });
    const orderId = req.params.orderId;
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(404).json({ message: "Order not found" });
    }
    const parsed = parseVendorAction(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ message: "Please check the details and try again.", errors: parsed.errors });
    }
    const { action, historyNote, shipment } = parsed.value;
    const rule = VENDOR_ACTIONS[action];

    const set: Record<string, unknown> = { "vendorOrders.$[mine].status": rule.to };
    if (shipment) {
      set["vendorOrders.$[mine].shiprocket"] = {
        courierName: shipment.courierName,
        awbCode: shipment.trackingNumber,
        trackingUrl: shipment.trackingUrl,
      };
    }
    const entry: Record<string, unknown> = { status: rule.to, changedAt: new Date(), by: "vendor" };
    if (historyNote) entry.note = historyNote;

    const updated = (await EssentialOrders.findOneAndUpdate(
      { _id: orderId, vendorOrders: { $elemMatch: { vendorId, status: { $in: rule.from } } } },
      { $set: set, $push: { "vendorOrders.$[mine].statusHistory": entry } },
      {
        new: true,
        arrayFilters: [{ "mine.vendorId": vendorId, "mine.status": { $in: rule.from } }],
        lean: true,
      },
    )) as unknown as LeanOrder | null;

    if (!updated) {
      // Nothing changed: either this is not the vendor's order (404) or it has already moved on (409).
      const current = (await EssentialOrders.findOne(
        { _id: orderId, "vendorOrders.vendorId": vendorId },
        { vendorOrders: 1 },
      ).lean()) as unknown as LeanOrder | null;
      const mine = current?.vendorOrders.find((entry) => entry.vendorId === vendorId);
      if (!mine) return res.status(404).json({ message: "Order not found" });
      return res.status(409).json({
        message: "This order has already moved on. Refresh to see its latest status.",
        stage: stageOf(mine.status),
      });
    }

    const sub = updated.vendorOrders.find((entry) => entry.vendorId === vendorId);
    if (sub && (rule.to === "REJECTED" || rule.to === "CANCELLED")) {
      await releaseReservedStock(String(updated._id), sub);
    }

    const view = toView(updated, vendorId, true);
    return res.json({ order: view, counts: await stageCounts(vendorId) });
  } catch (error) {
    console.error("Failed to update vendor order:", error);
    return res.status(500).json({ message: "We could not update this order. Please try again." });
  }
});

export default router;
