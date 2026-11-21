import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { SESSION_COOKIE, verifySession, type Role } from "./jwt";
import { forbidden, unauthorized } from "./errors";

export interface Actor { id: string; name: string; role: Role }

/** Reads session from Authorization: Bearer (mobile apps) or the httpOnly cookie (web). */
export async function getActor(): Promise<Actor | null> {
  const h = await headers();
  const bearer = h.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  const token = bearer ?? (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims) return null;
  // Confirm the account is still active (deactivated staff lose access immediately)
  const [u] = await db.select({ id: schema.users.id, name: schema.users.name, role: schema.users.role, active: schema.users.active })
    .from(schema.users).where(eq(schema.users.id, claims.sub)).limit(1);
  if (!u || !u.active) return null;
  return { id: u.id, name: u.name, role: u.role };
}

/** Enforce authentication + role on the server (SDD §2: never only in the UI). */
export async function requireRole(...roles: Role[]): Promise<Actor> {
  const a = await getActor();
  if (!a) throw unauthorized();
  if (roles.length && !roles.includes(a.role)) throw forbidden();
  return a;
}
export const ALL_STAFF: Role[] = ["ADMIN", "STAFF", "TRIP_STAFF"];
export const BOOKING_STAFF: Role[] = ["ADMIN", "STAFF"];
