import express, { Request, Response, Router } from "express";
import { Users } from "../models/userModels";

const router: Router = express.Router();
router.post("/", async (req: Request, res: Response) => {
  const newUser = req.body.data;
  const newUserInstance = new Users({ ...newUser });
  await newUserInstance.save();
  res.json({ msg: "User added successfully !", status: true, newUser });
});

export default router;
