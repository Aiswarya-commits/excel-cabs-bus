import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, jsonBody } from "@/lib/api";
import { requireRole, ALL_STAFF } from "@/lib/auth";
import { routeSchema } from "@/lib/validation";
import { audit } from "@/server/audit";

export const GET = handle(async () => {
  await requireRole(...ALL_STAFF);
  const data = await db.query.routes.findMany({ with: { stops: { orderBy: asc(schema.routeStops.sequence) } }, orderBy: asc(schema.routes.name) });
  return { data };
});

export const POST = handle(async (req) => {
  const actor = await requireRole("ADMIN");
  const input = routeSchema.parse(await jsonBody(req));
  return db.transaction(async (tx) => {
    const [r] = await tx.insert(schema.routes).values({ name: input.name, origin: input.origin, destination: input.destination, distanceKm: input.distanceKm ?? null, active: input.active ?? true }).returning();
    await tx.insert(schema.routeStops).values(input.stops.map((s, i) => ({ ...s, routeId: r.id, sequence: i + 1 })));
    await audit(tx, actor, "route.create", "route", r.id, { name: r.name });
    return { data: r };
  });
});
