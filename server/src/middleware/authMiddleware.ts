import jwt from "jsonwebtoken";
import { getJwtSecret } from "../services/authTokens";

export function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded; // { name: { userId, userEmail, userName } }
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
