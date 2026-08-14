import express, { Request, Response, Router } from "express";
import { Users } from "../models/userModels";
import { ChatUsers } from "../models/chatUserModel";

const router: Router = express.Router();

const MAX_RECENT_SEARCHES = 10;
const MAX_TERM_LENGTH = 100;

// requireAuth sets req.user = decoded, and the token is signed as
// { name: userFound } (see authorizeUser.ts / orderRoutes.ts), so the
// actual user fields live one level down at req.user.name.
function getAuthedUserId(req: Request): number | undefined {
  const decoded = (req as any).user;
  return decoded?.name?.userId;
}

// requireAuth only verifies the JWT signature — it doesn't guarantee the
// decoded payload actually has the shape these routes expect. Without this,
// a malformed/foreign-shaped token would fall through to
// Users.findOne({ userId: undefined }), which is an ambiguous query rather
// than a clean failure.
function requireAuthedUserId(
  req: Request,
  res: Response,
): number | undefined {
  const userId = getAuthedUserId(req);
  if (typeof userId !== "number") {
    res.status(401).json({ message: "Invalid session" });
    return undefined;
  }
  return userId;
}

router.get("/userData/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await Users.findOne({ _id: id });
  res.json(user);
});

router.get("/userlist", async (req: Request, res: Response) => {
  const users = await ChatUsers.find({});
  res.json(users);
});

router.get("/recent-searches", async (req: Request, res: Response) => {
  try {
    const userId = requireAuthedUserId(req, res);
    if (userId === undefined) return;

    const user = await Users.findOne({ userId });
    const terms = (user?.recentSearches || []).map((entry: any) => entry.term);
    return res.json(terms);
  } catch (error) {
    console.error("Failed to fetch recent searches:", error);
    return res.status(500).json({ message: "Failed to fetch recent searches" });
  }
});

router.post("/recent-searches", async (req: Request, res: Response) => {
  try {
    const userId = requireAuthedUserId(req, res);
    if (userId === undefined) return;

    const term = (typeof req.body?.term === "string" ? req.body.term.trim() : "").slice(
      0,
      MAX_TERM_LENGTH,
    );
    if (!term) {
      return res.status(400).json({ message: "term is required" });
    }

    const user = await Users.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existing = (user.recentSearches || [])
      .filter((entry: any) => entry.term.toLowerCase() !== term.toLowerCase())
      .map((entry: any) => ({ term: entry.term, searchedAt: entry.searchedAt }));
    const updated = [{ term, searchedAt: new Date() }, ...existing].slice(
      0,
      MAX_RECENT_SEARCHES,
    );
    user.recentSearches = updated as any;
    await user.save();

    return res.json(updated.map((entry) => entry.term));
  } catch (error) {
    console.error("Failed to save recent search:", error);
    return res.status(500).json({ message: "Failed to save recent search" });
  }
});

router.delete("/recent-searches/:term", async (req: Request, res: Response) => {
  try {
    const userId = requireAuthedUserId(req, res);
    if (userId === undefined) return;

    const term = req.params.term;

    const user = await Users.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updated = (user.recentSearches || [])
      .filter((entry: any) => entry.term.toLowerCase() !== term.toLowerCase())
      .map((entry: any) => ({ term: entry.term, searchedAt: entry.searchedAt }));
    user.recentSearches = updated as any;
    await user.save();

    return res.json(updated.map((entry) => entry.term));
  } catch (error) {
    console.error("Failed to remove recent search:", error);
    return res.status(500).json({ message: "Failed to remove recent search" });
  }
});

router.delete("/recent-searches", async (req: Request, res: Response) => {
  try {
    const userId = requireAuthedUserId(req, res);
    if (userId === undefined) return;

    const user = await Users.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.recentSearches = [] as any;
    await user.save();

    return res.json([]);
  } catch (error) {
    console.error("Failed to clear recent searches:", error);
    return res.status(500).json({ message: "Failed to clear recent searches" });
  }
});

export default router;
