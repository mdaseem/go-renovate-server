// Who can do what. Three roles:
//   customer  - everyone by default
//   vendor    - set (later) when an admin links the account to a vendor profile
//   admin     - decided by the ADMIN_EMAILS environment variable (comma separated), nothing stored
// The role is NEVER read from the browser: not from signup, not from the token.
export type Role = "customer" | "vendor" | "admin";
export const ROLES: Role[] = ["customer", "vendor", "admin"];

// Read lazily: index.ts calls dotenv.config() after its imports have run.
let warnedUnverified = false;

function configuredAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function adminEmails(): string[] {
  const list = configuredAdminEmails();
  // Fail closed: while Google logins are not verified (no GOOGLE_CLIENT_ID), anyone could claim an
  // admin's email, so nobody is treated as admin until it is set.
  if (list.length > 0 && !process.env.GOOGLE_CLIENT_ID) {
    if (!warnedUnverified) {
      warnedUnverified = true;
      console.warn(
        "[auth] ADMIN_EMAILS is set but GOOGLE_CLIENT_ID is not, so admin access is DISABLED (Google logins are not verified). Set GOOGLE_CLIENT_ID.",
      );
    }
    return [];
  }
  return list;
}

export function isAdminEmail(email: unknown): boolean {
  return typeof email === "string" && adminEmails().includes(email.trim().toLowerCase());
}

// True for any email listed in ADMIN_EMAILS, whether or not admin access is currently switched on.
// Signup uses this so nobody can register a password account on an admin's email.
export function isReservedAdminEmail(email: unknown): boolean {
  return typeof email === "string" && configuredAdminEmails().includes(email.trim().toLowerCase());
}

interface RoleSource {
  get(path: string): unknown;
}

// An admin email always wins (so removing it from ADMIN_EMAILS takes admin away immediately).
// Otherwise the stored role, and anyone without one - every account created before roles
// existed - is a customer.
export function resolveRole(user: RoleSource): Role {
  if (isAdminEmail(user.get("userEmail"))) return "admin";
  const stored = user.get("role");
  return stored === "vendor" ? "vendor" : "customer";
}
