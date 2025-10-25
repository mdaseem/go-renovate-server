import express, { Request, Response, Router } from "express";
import { Users } from "../models/userModels";

const router: Router = express.Router();
router.get("/userData/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await Users.findOne({ _id: id });
  res.json(user);
});

export default router;
