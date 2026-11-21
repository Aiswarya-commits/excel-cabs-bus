import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, jsonBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { busSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";
import { audit } from "@/server/audit";

type P = { id: string };
export const PATCH = handle<P>(async (req, { params }) => {
  const actor = await requireRole("ADMIN");
  const { id } = await params;
  const input = busSchema.partial().parse(await jsonBody(req));
  const [b] = await db.update(schema.buses).set({ ...input, updatedAt: new Date() }).where(eq(schema.buses.id, id)).returning();
  if (!b) throw notFound("Bus not found");
  await audit(db, actor, "bus.update", "bus", id, input);
  return { data: b };
});
