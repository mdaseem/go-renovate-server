import jwt from "jsonwebtoken";

const LEGACY_SECRET = "any_random_string_generated_once";
const MIN_SECRET_LENGTH = 32;
let warned = false;


export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
  if (!warned) {
    warned = true;
    console.warn(
      `[auth] JWT_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters, so the OLD built-in secret is being used. ` +
        "Anyone who has seen the source code can forge login tokens. Set JWT_SECRET on the server.",
    );
  }
  return LEGACY_SECRET;
}

export interface TokenUser {
  userId?: number;
  userEmail?: string;
  userName?: string;
}

export function signUserToken(user: TokenUser): string {
  const payload = {
    name: {
      userId: user.userId,
      userEmail: user.userEmail,
      userName: user.userName,
    },
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "2 days" });
}
