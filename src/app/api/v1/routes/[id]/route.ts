import { asc, eq, inArray, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, jsonBody } from "@/lib/api";
import { requireRole, ALL_STAFF } from "@/lib/auth";
import { routeSchema } from "@/lib/validation";
import { badRequest, notFound } from "@/lib/errors";
import { audit } from "@/server/audit";

type P = { id: string };
export const GET = handle<P>(async (_r, { params }) => {
  await requireRole(...ALL_STAFF);
  const r = await db.query.routes.findFirst({ where: eq(schema.routes.id, (await params).id), with: { stops: { orderBy: asc(schema.routeStops.sequence) } } });
  if (!r) throw notFound("Route not found");
  return { data: r };
});

// PATCH replaces stops only if no bookings reference the current stops
export const PATCH = handle<P>(async (req, { params }) => {
  const actor = await requireRole("ADMIN");
  const { id } = await params;
  const input = routeSchema.partial().parse(await jsonBody(req));
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(schema.routes).where(eq(schema.routes.id, id));
    if (!r) throw notFound("Route not found");
    const { stops, ...rest } = input;
    if (Object.keys(rest).length) await tx.update(schema.routes).set({ ...rest, updatedAt: new Date() }).where(eq(schema.routes.id, id));
    if (stops) {
      const cur = await tx.select().from(schema.routeStops).where(eq(schema.routeStops.routeId, id));
      const ids = cur.map((s) => s.id);
      const used = ids.length ? await tx.select({ id: schema.bookings.id }).from(schema.bookings).where(or(inArray(schema.bookings.boardingStopId, ids), inArray(schema.bookings.dropStopId, ids))).limit(1) : [];
      if (used.length) {
        // Stops in use: allow renaming / timing / flags but not adding or removing
        if (stops.length !== cur.length) throw badRequest("This route has bookings — you can edit stop details but not add/remove stops. Create a new route instead.");
        const sorted = [...cur].sort((a, b) => a.sequence - b.sequence);
        for (let i = 0; i < stops.length; i++) await tx.update(schema.routeStops).set(stops[i]).where(eq(schema.routeStops.id, sorted[i].id));
      } else {
        await tx.delete(schema.routeStops).where(eq(schema.routeStops.routeId, id));
        await tx.insert(schema.routeStops).values(stops.map((s, i) => ({ ...s, routeId: id, sequence: i + 1 })));
      }
    }
    await audit(tx, actor, "route.update", "route", id, input);
    return { ok: true };
  });
});
