import express, { Request, Response, Router } from "express";
import { Orders, OrderStatus, ORDER_STATUS_TRANSITIONS } from "../models/orderModel";

const router: Router = express.Router();

const STATUS_MAP: Record<string, OrderStatus> = {
  "PICKED UP": "PICKUP_SCHEDULED",
  "PICKUP SCHEDULED": "PICKUP_SCHEDULED",
  "IN TRANSIT": "IN_TRANSIT",
  "OUT FOR DELIVERY": "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  CANCELED: "CANCELLED",
};

// Unauthenticated — Shiprocket calls this directly with no bearer token.
// Always responds 200 so an event we intentionally ignore (unknown order,
// unmapped status, illegal transition) doesn't trigger a retry storm.
router.post("/", async (req: Request, res: Response) => {
  try {
    const { awb, order_id: shiprocketOrderId, current_status: currentStatus } =
      req.body as { awb?: string; order_id?: string; current_status?: string };

    const mappedStatus = currentStatus
      ? STATUS_MAP[currentStatus.toUpperCase()]
      : undefined;

    if (!mappedStatus || (!awb && !shiprocketOrderId)) {
      return res.status(200).json({ received: true, applied: false });
    }

    const order = awb
      ? await Orders.findOne({ "shiprocket.awbCode": awb })
      : await Orders.findOne({ "shiprocket.orderId": shiprocketOrderId });

    if (!order) {
      console.warn("Shiprocket webhook: no matching order for", {
        awb,
        shiprocketOrderId,
      });
      return res.status(200).json({ received: true, applied: false });
    }

    const current = order.get("status") as OrderStatus;
    const allowedNext = ORDER_STATUS_TRANSITIONS[current] || [];
    if (!allowedNext.includes(mappedStatus)) {
      return res.status(200).json({ received: true, applied: false });
    }

    order.set("status", mappedStatus);
    order.get("statusHistory").push({
      status: mappedStatus,
      note: `Updated via Shiprocket webhook (${currentStatus})`,
      changedAt: new Date(),
    });
    if (order.get("shiprocket")) {
      order.set("shiprocket.status", currentStatus);
    }
    await order.save();

    return res.status(200).json({ received: true, applied: true });
  } catch (error) {
    console.error("Shiprocket webhook processing failed:", error);
    return res.status(200).json({ received: true, applied: false });
  }
});

export default router;
