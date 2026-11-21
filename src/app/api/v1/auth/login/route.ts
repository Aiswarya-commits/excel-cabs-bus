import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, jsonBody, clientIp } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/ratelimit";
import { unauthorized } from "@/lib/errors";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/jwt";
import { audit } from "@/server/audit";

export const POST = handle(async (req) => {
  rateLimit(`login:${clientIp(req)}`, 10, 60_000);
  const { email, password } = loginSchema.parse(await jsonBody(req));
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  // Always run bcrypt to keep timing similar whether or not the user exists
  const ok = await bcrypt.compare(password, u?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!u || !ok || !u.active) throw unauthorized("Invalid email or password");
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, u.id));
  const token = await signSession({ sub: u.id, name: u.name, role: u.role });
  await audit(db, { id: u.id, name: u.name, role: u.role }, "auth.login", "user", u.id);
  const res = NextResponse.json({ token, expiresIn: SESSION_TTL_SECONDS, user: { id: u.id, name: u.name, email: u.email, role: u.role } });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_TTL_SECONDS });
  return res;
});
