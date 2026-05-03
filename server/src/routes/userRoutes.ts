import express, { Request, Response, Router } from "express";
import { Users } from "../models/userModels";
import { ChatUsers } from "../models/chatUserModel";

const router: Router = express.Router();
router.get("/userData/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await Users.findOne({ _id: id });
  res.json(user);
});

router.get("/userlist", async (req: Request, res: Response) => {
  const users = await ChatUsers.find({});
  res.json(users);
});

export default router;
