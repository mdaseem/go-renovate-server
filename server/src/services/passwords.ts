import crypto from "crypto";

// Password hashing with Node's built-in scrypt (no extra package). Stored form:
//   scrypt$<N>$<r>$<p>$<salt base64>$<key base64>
// Passwords created before hashing existed are stored as plain text; verifyPassword()
// still accepts those ONCE and tells the caller to upgrade them (see authorizeUser.ts).
const PREFIX = "scrypt";
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export const MIN_PASSWORD_LENGTH = 8; // same rule as the frontend signup form
export const MAX_PASSWORD_LENGTH = 128; // stops absurdly long inputs from tying up the CPU

function derive(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
  keyLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, { N: n, r, p }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export function isHashed(stored: unknown): stored is string {
  return typeof stored === "string" && stored.startsWith(`${PREFIX}$`);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, N, R, P, KEY_LENGTH);
  return [PREFIX, N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

// Compares two strings without leaking, through timing, how much of them matched.
function safeEqual(a: string, b: string): boolean {
  const digestA = crypto.createHash("sha256").update(a).digest();
  const digestB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export interface PasswordCheck {
  ok: boolean;
  // true when the stored value is still plain text and should be replaced by a hash
  needsUpgrade: boolean;
}

export async function verifyPassword(
  plain: string,
  stored: unknown,
): Promise<PasswordCheck> {
  if (typeof stored !== "string" || stored.length === 0) {
    return { ok: false, needsUpgrade: false };
  }
  if (!isHashed(stored)) {
    // Legacy plain-text password.
    return { ok: safeEqual(plain, stored), needsUpgrade: true };
  }
  const [, n, r, p, saltB64, keyB64] = stored.split("$");
  const salt = Buffer.from(saltB64 ?? "", "base64");
  const expected = Buffer.from(keyB64 ?? "", "base64");
  if (!salt.length || !expected.length) {
    return { ok: false, needsUpgrade: false };
  }
  try {
    const actual = await derive(plain, salt, Number(n), Number(r), Number(p), expected.length);
    return { ok: crypto.timingSafeEqual(actual, expected), needsUpgrade: false };
  } catch {
    return { ok: false, needsUpgrade: false };
  }
}
