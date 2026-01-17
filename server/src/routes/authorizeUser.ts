import express, { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import { Users } from "../models/userModels";

const router: Router = express.Router();
router.post("/", async (req: Request, res: Response) => {
  const data = req.body;
  const allUsers = await Users.find({});
  const userFound = allUsers?.find(
    (item) =>
      item?.userEmail === data?.userEmail &&
      item?.userPassword === data?.password
  );
  const validUserData = data.isGoogleLogin || userFound;
  if (data?.password && !userFound) {
    return res.json({ message: "Invalid password", status: false });
  }
  if (validUserData) {
    let payload = { name: data };
    jwt.sign(
      payload,
      "any_random_string_generated_once",
      { expiresIn: "2 Days" },
      (err, token) => {
        if (err) console.log(err);
        else return res.json({ token, status: true });
      }
    );
  } else {
    res.json({ message: "Invalid user", status: false });
  }
});

export default router;
