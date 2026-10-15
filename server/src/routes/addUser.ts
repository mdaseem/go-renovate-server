import express, { Request, Response, Router } from "express";
import { Users } from "../models/userModels";
import {
  hashPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "../services/passwords";
import { isReservedAdminEmail } from "../services/roles";

const router: Router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 100;

function text(value: unknown, max: number): string {
  return typeof value === "string" && value.length <= max ? value.trim() : "";
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const legacy = body.data && typeof body.data === "object" ? body.data : null;

    const email = text(legacy ? legacy.userEmail : body.email, MAX_EMAIL_LENGTH);
    const password: unknown = legacy ? legacy.userPassword : body.password;
    const requestedName = text(legacy ? legacy.userName : body.name, MAX_NAME_LENGTH);

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }
    if (
      typeof password !== "string" ||
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return res.status(400).json({
        message: `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`,
      });
    }

    // An admin email is only ever usable through a verified Google sign-in. Password accounts are not
    // email-verified, so letting anyone register it would let them become admin.
    if (isReservedAdminEmail(email)) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });
    }

    const existing = await Users.findOne({
      userEmail: { $in: [email, email.toLowerCase()] },
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });
    }

    const normalizedEmail = email.toLowerCase();
    await Users.create({
      userEmail: normalizedEmail,
      userPassword: await hashPassword(password),
      userName: requestedName || normalizedEmail.split("@")[0],
      userId: Date.now(),
      connections: [],
    });

    return res.json({
      msg: "User added successfully !",
      status: true,
      newUser: normalizedEmail,
    });
  } catch (error) {
    console.error("Signup failed:", error);
    return res.status(500).json({ message: "Signup failed. Please try again." });
  }
});

export default router;
