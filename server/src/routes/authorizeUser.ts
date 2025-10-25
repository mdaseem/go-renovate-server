import express, { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import { Users } from "../models/userModels";

const router: Router = express.Router();
router.post("/", async (req: Request, res: Response) => {
  const data = req.body.data;
  const allUsers = await Users.find({});
  const validUserData = allUsers?.find(
    (item) =>
      item?.userEmail === data?.userEmail &&
      item?.userPassword === data?.userPassword
  );
  if (validUserData) {
    let payload = { name: data, lastLogin: "Monday 25th" };
    jwt.sign(
      payload,
      process.env.SECRET_KEY || "OtherSecretKey",
      { expiresIn: "2 Days" },
      (err, token) => {
        if (err) console.log(err);
        else return res.json({ token, status: true, validUserData });
      }
    );
  } else {
    res.json({ message: "Invalid user",status: false });
  }
});

export default router;
