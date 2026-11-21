// Edge-safe JWT helpers (used by middleware and API)
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ec_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours
export type Role = "ADMIN" | "STAFF" | "TRIP_STAFF";
export interface SessionClaims { sub: string; name: string; role: Role }

function secret() {
  let s = process.env.JWT_SECRET;
  // Local demo mode (no DATABASE_URL, no JWT_SECRET): use a fixed dev secret so it runs with zero setup.
  // Never deploy like this — set a long random JWT_SECRET in production.
  if (!s && !process.env.DATABASE_URL) s = "local-demo-secret-change-me-before-deploying-0001";
  if (!s || s.length < 16) throw new Error("JWT_SECRET is missing or too short");
  return new TextEncoder().encode(s);
}
export async function signSession(c: SessionClaims): Promise<string> {
  return new SignJWT({ name: c.name, role: c.role })
    .setProtectedHeader({ alg: "HS256" }).setSubject(c.sub)
    .setIssuedAt().setExpirationTime(`${SESSION_TTL_SECONDS}s`).sign(secret());
}
export async function verifySession(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return { sub: payload.sub as string, name: payload.name as string, role: payload.role as Role };
  } catch { return null; }
}
/** Short HMAC used in public ticket links so booking refs alone can't be enumerated. */
export async function ticketKey(reference: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", secret(), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`ticket:${reference}`)));
  return Array.from(sig.slice(0, 6)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
