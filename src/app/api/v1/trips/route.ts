import { and, asc, eq, gte, lte, inArray, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, jsonBody } from "@/lib/api";
import { requireRole, ALL_STAFF, BOOKING_STAFF } from "@/lib/auth";
import { tripSchema } from "@/lib/validation";
import { localToUtc, addDays, todayLocal } from "@/lib/time";
import { badRequest } from "@/lib/errors";
import { toPaise } from "@/lib/money";
import { tripOccupancy } from "@/server/trips";
import { audit } from "@/server/audit";

const { trips } = schema;

// GET /trips?from=YYYY-MM-DD&to=YYYY-MM-DD&routeId=&status=
export const GET = handle(async (req) => {
  await requireRole(...ALL_STAFF);
  const u = new URL(req.url).searchParams;
  const from = u.get("from") || todayLocal(); const to = u.get("to") || from;
  const conds: SQL[] = [gte(trips.travelDate, from), lte(trips.travelDate, to)];
  if (u.get("routeId")) conds.push(eq(trips.routeId, u.get("routeId")!));
  if (u.get("status")) conds.push(inArray(trips.status, u.get("status")!.split(",") as ("OPEN")[]));
  const list = await db.query.trips.findMany({ where: and(...conds), with: { route: true, bus: true }, orderBy: asc(trips.departAt), limit: 500 });
  const occ = await tripOccupancy(list.map((t) => t.id));
  return {
    data: list.map((t) => ({
      id: t.id, travelDate: t.travelDate, departAt: t.departAt, arriveAt: t.arriveAt, fare: toPaise(t.fare), status: t.status, notes: t.notes,
      route: { id: t.route.id, name: t.route.name }, bus: { id: t.bus.id, name: t.bus.name, registration: t.bus.registration, type: t.bus.type },
      capacity: t.capacityOverride ?? t.bus.capacity, capacityOverride: t.capacityOverride, booked: occ.get(t.id)!.booked,
    })),
  };
});

// POST /trips — create one trip or a daily schedule (repeatDays)
export const POST = handle(async (req) => {
  const actor = await requireRole(...BOOKING_STAFF);
  const input = tripSchema.parse(await jsonBody(req));
  const route = await db.query.routes.findFirst({ where: eq(schema.routes.id, input.routeId) });
  const bus = await db.query.buses.findFirst({ where: eq(schema.buses.id, input.busId) });
  if (!route || !route.active) throw badRequest("Route not found or inactive");
  if (!bus || !bus.active) throw badRequest("Bus not found or inactive");
  if (input.capacityOverride && input.capacityOverride > bus.capacity && bus.seatLayout) throw badRequest("Capacity override cannot exceed the bus seat count");
  const created = await db.transaction(async (tx) => {
    const rows = [];
    for (let i = 0; i < input.repeatDays; i++) {
      const date = addDays(input.travelDate, i);
      const dep = localToUtc(date, input.departureTime);
      let arr = localToUtc(date, input.arrivalTime);
      if (arr <= dep) arr = new Date(arr.getTime() + 86400000); // overnight arrival
      const [t] = await tx.insert(trips).values({ routeId: route.id, busId: bus.id, travelDate: date, departAt: dep, arriveAt: arr, fare: input.fare, status: input.status, capacityOverride: input.capacityOverride ?? null, notes: input.notes }).returning();
      rows.push(t);
    }
    await audit(tx, actor, "trip.create", "trip", rows[0].id, { count: rows.length, route: route.name, from: input.travelDate });
    return rows;
  });
  return { data: created.map((t) => ({ id: t.id, travelDate: t.travelDate })), count: created.length };
});
