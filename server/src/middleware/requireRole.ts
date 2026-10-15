import { NextFunction, Request, Response } from "express";
import { Users } from "../models/userModels";
import { Role, resolveRole } from "../services/roles";

export interface CurrentUser {
  userId: number;
  userEmail: string | undefined;
  userName: string | undefined;
  role: Role;
  vendorId: string | null;
}

// Loads the signed-in user from the database using the id inside the token (requireAuth must
// have run first). The role always comes from the database / ADMIN_EMAILS, never from the
// token, so a role change takes effect on the next request without logging in again.
export async function loadCurrentUser(req: Request): Promise<CurrentUser | null> {
  const tokenUser = (req as any).user?.name;
  const userId = tokenUser?.userId;
  if (typeof userId !== "number") return null;

  // Look up by email, then confirm the id. Some older accounts store their numeric userId as text in
  // the database, which a query on userId alone would not match (the token's id is already a number).
  const email = tokenUser?.userEmail;
  const candidates =
    typeof email === "string" ? await Users.find({ userEmail: email }) : await Users.find({ userId });
  const user = candidates.find((candidate) => Number(candidate.userId) === userId);
  if (!user) return null;

  return {
    userId,
    userEmail: user.userEmail ?? undefined,
    userName: user.userName ?? undefined,
    role: resolveRole(user),
    vendorId: (user.get("vendorId") as string | null | undefined) ?? null,
  };
}

// Use after requireAuth:  router.use(requireAuth, requireRole("admin"))
// Sets req.currentUser for the handlers that follow.
export function requireRole(...allowed: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await loadCurrentUser(req);
      if (!current) {
        return res.status(401).json({ message: "Invalid session" });
      }
      if (!allowed.includes(current.role)) {
        return res.status(403).json({ message: "You do not have access to this" });
      }
      (req as any).currentUser = current;
      next();
    } catch (error) {
      console.error("Role check failed:", error);
      res.status(500).json({ message: "Could not check your access. Please try again." });
    }
  };
}
