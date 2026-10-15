import crypto from "crypto";
import express, { Request, Response, Router } from "express";
import mongoose from "mongoose";
import { Categories } from "../models/categoryModel";
import { Essentials } from "../models/essentialModel";
import { Designs } from "../models/designModel";

const router: Router = express.Router();

const MAX_PIECES = 60;
const OBJECT_ID = /^[0-9a-f]{24}$/;
const PIECE_KEY = /^[0-9a-f]{24}#\d{1,3}$/;
// A piece resting on another piece ("<id>#<copy>") or on a part of the room ("space:counter-0").
const SUPPORT_KEY = /^([0-9a-f]{24}#\d{1,3}|space:[a-z0-9:-]{1,40})$/;
const SLUG = /^[a-z0-9-]{1,64}$/;
const TOKEN = /^[a-z0-9-]{1,32}$/;
const SHORT_ID = /^[A-Za-z0-9]{10}$/;
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Anyone can save, so the endpoint is rate limited per IP (in memory - fine for
// one server instance; move to a shared store if the API is ever scaled out).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_SAVES_PER_WINDOW = 12;
const saves = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (saves.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_SAVES_PER_WINDOW) {
    saves.set(ip, recent);
    return true;
  }
  recent.push(now);
  saves.set(ip, recent);
  // Keep the map from growing forever.
  if (saves.size > 5000) {
    for (const [key, times] of saves) {
      if (times.every((time) => now - time >= WINDOW_MS)) saves.delete(key);
    }
  }
  return false;
}

function makeShortId(): string {
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

const isFiniteNumber = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

// Returns a cleaned transform or null when anything is out of range - the
// client is untrusted, and these values end up drawn on other people's screens.
function cleanPosition(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const input = raw as Record<string, unknown>;
  if (!isFiniteNumber(input.x, -50, 150) || !isFiniteNumber(input.y, -50, 150)) return null;
  const out: Record<string, unknown> = { x: input.x, y: input.y };
  if (input.scale !== undefined) {
    if (!isFiniteNumber(input.scale, 0.5, 2)) return null;
    out.scale = input.scale;
  }
  if (input.flipped !== undefined) {
    if (typeof input.flipped !== "boolean") return null;
    out.flipped = input.flipped;
  }
  if (input.front !== undefined) {
    if (typeof input.front !== "boolean") return null;
    out.front = input.front;
  }
  if (input.onKey !== undefined) {
    if (typeof input.onKey !== "string" || !SUPPORT_KEY.test(input.onKey)) return null;
    out.onKey = input.onKey;
  }
  if (input.dx !== undefined) {
    if (!isFiniteNumber(input.dx, -100, 100)) return null;
    out.dx = input.dx;
  }
  return out;
}

// undefined = invalid, null = not provided.
function optionalNumber(value: unknown, min: number, max: number): number | null | undefined {
  if (value === undefined || value === null) return null;
  return isFiniteNumber(value, min, max) ? value : undefined;
}

function optionalToken(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === "string" && TOKEN.test(value) ? value : undefined;
}

router.post("/", async (req: Request, res: Response) => {
  try {
    if (isRateLimited(req.ip ?? "unknown")) {
      return res.status(429).json({
        message: "You are saving designs too quickly. Please try again in a few minutes.",
      });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;

    const { categorySlug, spaceSlug, essentialIds, positions } = body;
    if (typeof categorySlug !== "string" || !SLUG.test(categorySlug)) {
      return res.status(400).json({ message: "A valid categorySlug is required" });
    }
    if (
      spaceSlug !== undefined &&
      spaceSlug !== null &&
      (typeof spaceSlug !== "string" || !SLUG.test(spaceSlug))
    ) {
      return res.status(400).json({ message: "Invalid spaceSlug" });
    }
    if (
      !Array.isArray(essentialIds) ||
      essentialIds.length < 1 ||
      essentialIds.length > MAX_PIECES ||
      !essentialIds.every((id) => typeof id === "string" && OBJECT_ID.test(id))
    ) {
      return res
        .status(400)
        .json({ message: `Add between 1 and ${MAX_PIECES} pieces to save a design` });
    }

    const cleanPositions: Record<string, unknown> = {};
    if (positions !== undefined && positions !== null) {
      if (typeof positions !== "object" || Array.isArray(positions)) {
        return res.status(400).json({ message: "Invalid positions" });
      }
      const entries = Object.entries(positions as Record<string, unknown>);
      if (entries.length > MAX_PIECES) {
        return res.status(400).json({ message: "Too many positions" });
      }
      for (const [key, value] of entries) {
        const cleaned = PIECE_KEY.test(key) ? cleanPosition(value) : null;
        if (!cleaned) return res.status(400).json({ message: "Invalid positions" });
        cleanPositions[key] = cleaned;
      }
    }

    const roomWidthCm = optionalNumber(body.roomWidthCm, 150, 1200);
    const roomHeightCm = optionalNumber(body.roomHeightCm, 200, 500);
    // same limits as the frontend's depth field (MIN / MAX_ROOM_DEPTH_CM)
    const roomDepthCm = optionalNumber(body.roomDepthCm, 150, 1200);
    if (roomWidthCm === undefined || roomHeightCm === undefined || roomDepthCm === undefined) {
      return res.status(400).json({ message: "Invalid room size" });
    }
    const wallId = optionalToken(body.wallId);
    const floorId = optionalToken(body.floorId);
    if (wallId === undefined || floorId === undefined) {
      return res.status(400).json({ message: "Invalid colours" });
    }

    // The category and every product must be real (a design can't be used to
    // store arbitrary ids), and every product must belong to that category.
    const uniqueIds = [...new Set(essentialIds as string[])];
    const [category, found] = await Promise.all([
      Categories.exists({ slug: categorySlug }),
      Essentials.countDocuments({
        _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) },
        categorySlugs: categorySlug,
      }),
    ]);
    if (!category) return res.status(404).json({ message: "Category not found" });
    if (found !== uniqueIds.length) {
      return res
        .status(400)
        .json({ message: "Some of those pieces are not available in this category" });
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const shortId = makeShortId();
      try {
        await Designs.create({
          shortId,
          categorySlug,
          spaceSlug: spaceSlug ?? null,
          essentialIds,
          positions: cleanPositions,
          roomWidthCm,
          roomHeightCm,
          roomDepthCm,
          wallId,
          floorId,
        });
        return res.status(201).json({ id: shortId });
      } catch (error) {
        // A duplicate shortId (vanishingly rare): try another one.
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    }
    return res.status(500).json({ message: "Could not save the design" });
  } catch (error) {
    console.error("Failed to save design:", error);
    return res.status(500).json({ message: "Could not save the design" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!SHORT_ID.test(id)) return res.status(404).json({ message: "Design not found" });
    const design = await Designs.findOne({ shortId: id });
    if (!design) return res.status(404).json({ message: "Design not found" });
    return res.json({
      id: design.shortId,
      categorySlug: design.categorySlug,
      spaceSlug: design.spaceSlug ?? null,
      essentialIds: design.essentialIds.map((essentialId) => essentialId.toString()),
      positions: design.positions ?? {},
      roomWidthCm: design.roomWidthCm ?? null,
      roomHeightCm: design.roomHeightCm ?? null,
      roomDepthCm: design.roomDepthCm ?? null,
      wallId: design.wallId ?? null,
      floorId: design.floorId ?? null,
    });
  } catch (error) {
    console.error("Failed to fetch design:", error);
    return res.status(500).json({ message: "Could not load the design" });
  }
});

export default router;
