import { Request } from "express";

// Slows down password guessing on POST /auth. Counts FAILED attempts per (email, caller address)
// in memory: fine for one server instance (same trade-off as the design-save limiter), and a restart
// resets it. Keyed by email + address so one attacker cannot lock everyone out, only guess slowly.
//
// The address is Express's req.ip, which index.ts configures with "trust proxy" (one hop on Render):
// that is the address the platform's proxy saw, NOT the first X-Forwarded-For entry, which the client
// controls and could change on every attempt to dodge the limit.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map<string, number[]>();

export function limiterKey(req: Request, email: string): string {
  return `${email.toLowerCase()}|${req.ip || req.socket.remoteAddress || "unknown"}`;
}

function recent(key: string, now: number): number[] {
  return (failures.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
}

export function isLoginBlocked(key: string): boolean {
  return recent(key, Date.now()).length >= MAX_FAILURES;
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const list = recent(key, now);
  list.push(now);
  failures.set(key, list);
  // Keep the map from growing forever.
  if (failures.size > 5000) {
    for (const [k, times] of failures) {
      if (times.every((time) => now - time >= WINDOW_MS)) failures.delete(k);
    }
  }
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}
