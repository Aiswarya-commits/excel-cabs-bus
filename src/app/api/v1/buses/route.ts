import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, jsonBody } from "@/lib/api";
import { requireRole, ALL_STAFF } from "@/lib/auth";
import { busSchema } from "@/lib/validation";
import { conflict } from "@/lib/errors";
import { audit } from "@/server/audit";

export const GET = handle(async () => {
  await requireRole(...ALL_STAFF);
  return { data: await db.select().from(schema.buses).orderBy(asc(schema.buses.name)) };
});
export const POST = handle(async (req) => {
  const actor = await requireRole("ADMIN");
  const input = busSchema.parse(await jsonBody(req));
  try {
    const [b] = await db.insert(schema.buses).values({ ...input, seatLayout: input.seatLayout ?? null, amenities: input.amenities ?? [] }).returning();
    await audit(db, actor, "bus.create", "bus", b.id, input);
    return { data: b };
  } catch (e) {
    if ((e as { code?: string }).code === "23505" || (e as { cause?: { code?: string } }).cause?.code === "23505") throw conflict("A bus with this registration already exists");
    throw e;
  }
});
