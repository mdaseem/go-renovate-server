import express, { Request, Response, Router } from "express";
import Message from "../models/messageModel";

const router: Router = express.Router();
// GET all messages of a room

router.get("/:roomId", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const messages = await Message.find({
      roomId,
    }).sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      messages,
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
