import bcrypt from "bcryptjs";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, jsonBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { userSchema } from "@/lib/validation";
import { conflict } from "@/lib/errors";
import { audit } from "@/server/audit";

const pub = { id: schema.users.id, name: schema.users.name, email: schema.users.email, phone: schema.users.phone, role: schema.users.role, active: schema.users.active, lastLoginAt: schema.users.lastLoginAt, createdAt: schema.users.createdAt };
export const GET = handle(async () => {
  await requireRole("ADMIN");
  return { data: await db.select(pub).from(schema.users).orderBy(asc(schema.users.name)) };
});
export const POST = handle(async (req) => {
  const actor = await requireRole("ADMIN");
  const { password, ...rest } = userSchema.parse(await jsonBody(req));
  try {
    const [u] = await db.insert(schema.users).values({ ...rest, passwordHash: await bcrypt.hash(password, 10) }).returning(pub);
    await audit(db, actor, "user.create", "user", u.id, { email: u.email, role: u.role });
    return { data: u };
  } catch (e) {
    if ((e as { cause?: { code?: string } }).cause?.code === "23505" || (e as { code?: string }).code === "23505") throw conflict("A user with this email already exists");
    throw e;
  }
});
