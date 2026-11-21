import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, jsonBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validation";
import { badRequest, notFound } from "@/lib/errors";
import { audit } from "@/server/audit";

type P = { id: string };
export const PATCH = handle<P>(async (req, { params }) => {
  const actor = await requireRole("ADMIN");
  const { id } = await params;
  const { password, ...rest } = userUpdateSchema.parse(await jsonBody(req));
  if (id === actor.id && (rest.active === false || (rest.role && rest.role !== "ADMIN"))) throw badRequest("You cannot deactivate or demote your own account");
  const patch: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (password) patch.passwordHash = await bcrypt.hash(password, 10);
  const [u] = await db.update(schema.users).set(patch).where(eq(schema.users.id, id)).returning({ id: schema.users.id });
  if (!u) throw notFound("User not found");
  await audit(db, actor, "user.update", "user", id, { ...rest, password: password ? "(changed)" : undefined });
  return { ok: true };
});
