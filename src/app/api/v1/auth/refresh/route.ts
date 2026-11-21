import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/jwt";

export const POST = handle(async () => {
  const a = await requireRole();
  const token = await signSession({ sub: a.id, name: a.name, role: a.role });
  const res = NextResponse.json({ token, expiresIn: SESSION_TTL_SECONDS });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_TTL_SECONDS });
  return res;
});
