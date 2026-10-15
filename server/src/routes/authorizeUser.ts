import express, { Request, Response, Router } from "express";
import { Users } from "../models/userModels";
import { requireAuth } from "../middleware/authMiddleware";
import { loadCurrentUser } from "../middleware/requireRole";
import { hashPassword, verifyPassword } from "../services/passwords";
import { signUserToken } from "../services/authTokens";
import { verifyGoogleLogin } from "../services/googleVerify";
import {
  clearLoginFailures,
  isLoginBlocked,
  limiterKey,
  recordLoginFailure,
} from "../services/loginLimiter";

const router: Router = express.Router();

const MAX_FIELD_LENGTH = 1024;

function asText(value: unknown): string {
  return typeof value === "string" && value.length <= MAX_FIELD_LENGTH
    ? value.trim()
    : "";
}


router.post("/", async (req: Request, res: Response) => {
  try {
    const data = req.body ?? {};
    const isGoogle = Boolean(data.isGoogleLogin);

    let userFound;

    if (isGoogle) {
      const email = asText(data.userEmail);
      if (!email) {
        return res.json({ message: "userEmail is required", status: false });
      }

      // Google logins carry no password, so prove the sign-in really happened for this email.
      const verdict = await verifyGoogleLogin(data.googleIdToken, email);
      if (!verdict.ok) {
        return res
          .status(verdict.status)
          .json({ message: verdict.message, status: false });
      }

      userFound = await Users.findOne({ userEmail: email });
      // Provision a Users document on first Google sign-in, since no other path creates one.
      if (!userFound) {
        userFound = await Users.create({
          userEmail: email,
          userName: asText(data.userName) || email,
          userId: Date.now(),
          connections: [],
        });
      }
    } else {
      const email = asText(data.email);
      const password =
        typeof data.password === "string" && data.password.length <= MAX_FIELD_LENGTH
          ? data.password
          : "";
      if (!email || !password) {
        return res.json({ message: "Email and password are required", status: false });
      }

      const key = limiterKey(req, email);
      if (isLoginBlocked(key)) {
        return res.status(429).json({
          message: "Too many attempts. Please wait a few minutes and try again.",
          status: false,
        });
      }

      // Several documents can share an email (for example a Google user and a password user),
      // so check each one's password instead of taking the first match.
      const candidates = await Users.find({
        userEmail: { $in: [email, email.toLowerCase()] },
      });
      for (const candidate of candidates) {
        const check = await verifyPassword(password, candidate.get("userPassword"));
        if (!check.ok) continue;
        userFound = candidate;
        if (check.needsUpgrade) {
          // First login since passwords were hashed: replace the plain text with a hash.
          try {
            await Users.updateOne(
              { _id: candidate._id },
              { $set: { userPassword: await hashPassword(password) } },
            );
          } catch (error) {
            console.error("Failed to upgrade a stored password:", error);
          }
        }
        break;
      }

      if (!userFound) {
        recordLoginFailure(key);
        return res.json({ message: "Invalid password", status: false });
      }
      clearLoginFailures(key);
    }

    const token = signUserToken({
      userId: userFound.userId ?? undefined,
      userEmail: userFound.userEmail ?? undefined,
      userName: userFound.userName ?? undefined,
    });
    return res.json({
      token,
      status: true,
      user: {
        name: userFound.userName,
        email: userFound.userEmail,
        id: userFound.userId,
        connections: userFound.connections,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ message: "Login failed", status: false });
  }
});

// GET /auth/me - who am I and what may I do, read fresh from the database (not from the token),
// so a role change shows up without logging in again. The frontend's vendor pages use this.
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const current = await loadCurrentUser(req);
    if (!current) {
      return res.status(401).json({ message: "Invalid session" });
    }
    return res.json({
      id: current.userId,
      email: current.userEmail,
      name: current.userName,
      role: current.role,
      vendorId: current.vendorId,
    });
  } catch (error) {
    console.error("Failed to load the current user:", error);
    return res.status(500).json({ message: "Could not load your account" });
  }
});

export default router;
