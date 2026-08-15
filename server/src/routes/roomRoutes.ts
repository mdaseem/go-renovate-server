import express, { Request, Response, Router } from "express";
import Message from "../models/messageModel";

const router: Router = express.Router();
// GET messages of a room, newest page first (paginated via ?limit=&before=)

router.get("/:roomId", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const limit = Math.min(
      Math.max(parseInt(req.query.limit as string, 10) || 30, 1),
      100,
    );

    const query: Record<string, unknown> = { roomId };
    if (req.query.before) {
      const before = new Date(req.query.before as string);
      if (!isNaN(before.getTime())) {
        query.createdAt = { $lt: before };
      }
    }

    const page = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const messages = page.reverse();

    return res.status(200).json({
      success: true,
      messages,
      hasMore: page.length === limit,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
    });
  }
});

export default router;
