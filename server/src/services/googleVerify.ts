import axios from "axios";

export type GoogleVerdict =
  | { ok: true }
  | { ok: false; status: number; message: string };

let warned = false;
const ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

export async function verifyGoogleLogin(
  idToken: unknown,
  email: string,
): Promise<GoogleVerdict> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    if (!warned) {
      warned = true;
      console.warn(
        "[auth] GOOGLE_CLIENT_ID is not set on the server, so Google logins are NOT verified: anyone can sign in as any Google user. Set it.",
      );
    }
    return { ok: true };
  }
  if (typeof idToken !== "string" || idToken.length === 0) {
    return { ok: false, status: 401, message: "Google sign-in could not be verified" };
  }
  try {
    const { data } = await axios.get("https://oauth2.googleapis.com/tokeninfo", {
      params: { id_token: idToken },
      timeout: 5000,
    });
    const emailMatches =
      typeof data?.email === "string" &&
      data.email.toLowerCase() === email.toLowerCase();
    const verified = data?.email_verified === true || data?.email_verified === "true";
    if (data?.aud !== clientId || !ISSUERS.includes(data?.iss) || !emailMatches || !verified) {
      // Which check failed, for the server log only (never sent to the browser).
      console.warn("[auth] Google sign-in rejected:", {
        audienceMatches: data?.aud === clientId,
        issuerOk: ISSUERS.includes(data?.iss),
        emailMatches,
        emailVerified: verified,
      });
      return { ok: false, status: 401, message: "Google sign-in could not be verified" };
    }
    return { ok: true };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response && error.response.status < 500) {
      // Google answered and said the token is bad or expired.
      return { ok: false, status: 401, message: "Google sign-in could not be verified" };
    }
    console.error("Google token verification failed:", error);
    return { ok: false, status: 503, message: "Could not verify Google sign-in. Please try again." };
  }
}
