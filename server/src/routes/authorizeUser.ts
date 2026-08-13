import express, { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import { Users } from "../models/userModels";

const router: Router = express.Router();
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = req.body;

    if (!data?.isGoogleLogin && (!data?.email || !data?.password)) {
      return res.json({ message: "Email and password are required", status: false });
    }
    if (data?.isGoogleLogin && !data?.userEmail) {
      return res.json({ message: "userEmail is required", status: false });
    }

    const allUsers = await Users.find({});

    // Google login sends `userEmail` (not `email`) and no password — look the
    // user up by that instead, and provision a Users document on first
    // Google sign-in since there's currently no other path that creates one
    // for them.
    let userFound = data.isGoogleLogin
      ? allUsers?.find((item) => item?.userEmail === data?.userEmail)
      : allUsers?.find(
          (item) =>
            item?.userEmail === data?.email &&
            item?.userPassword === data?.password,
        );

    if (data.isGoogleLogin && !userFound) {
      userFound = await Users.create({
        userEmail: data.userEmail,
        userName: data.userName || data.userEmail,
        userId: Date.now(),
        connections: [],
      });
    }

    if (data?.password && !userFound) {
      return res.json({ message: "Invalid password", status: false });
    }
    if (!userFound) {
      return res.json({ message: "Invalid user", status: false });
    }

    const payload = { name: userFound };
    jwt.sign(
      payload,
      "any_random_string_generated_once",
      { expiresIn: "2 Days" },
      (err, token) => {
        if (err || !token) {
          console.error("Failed to sign JWT:", err);
          return res.status(500).json({ message: "Login failed", status: false });
        }
        return res.json({
          token,
          status: true,
          user: {
            name: userFound?.userName,
            email: userFound?.userEmail,
            id: userFound?.userId,
            connections: userFound?.connections,
          },
        });
      },
    );
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ message: "Login failed", status: false });
  }
});

export default router;
