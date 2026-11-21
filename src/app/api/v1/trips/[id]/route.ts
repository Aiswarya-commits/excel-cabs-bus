import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, jsonBody } from "@/lib/api";
import { requireRole, BOOKING_STAFF } from "@/lib/auth";
import { tripUpdateSchema } from "@/lib/validation";
import { localToUtc, fmtTime24 } from "@/lib/time";
import { badRequest, notFound } from "@/lib/errors";
import { getTripDetail, tripOccupancy } from "@/server/trips";
import { audit } from "@/server/audit";

type P = { id: string };
export const GET = handle<P>(async (_req, { params }) => ({ data: await getTripDetail((await params).id) }));

export const PATCH = handle<P>(async (req, { params }) => {
  const actor = await requireRole(...BOOKING_STAFF);
  const { id } = await params;
  const input = tripUpdateSchema.parse(await jsonBody(req));
  const t = await db.query.trips.findFirst({ where: eq(schema.trips.id, id), with: { bus: true } });
  if (!t) throw notFound("Trip not found");
  const patch: Partial<typeof schema.trips.$inferInsert> = {};
  if (input.fare !== undefined) patch.fare = input.fare;
  if (input.status) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.routeId && input.routeId !== t.routeId) {
    const occ = (await tripOccupancy([id])).get(id)!;
    if (occ.booked > 0) throw badRequest("Cannot change the route of a trip that already has bookings");
    patch.routeId = input.routeId;
  }
  const date = input.travelDate ?? t.travelDate;
  if (input.travelDate || input.departureTime || input.arrivalTime) {
    const dep = localToUtc(date, input.departureTime ?? fmtTime24(t.departAt));
    let arr = localToUtc(date, input.arrivalTime ?? fmtTime24(t.arriveAt));
    if (arr <= dep) arr = new Date(arr.getTime() + 86400000);
    Object.assign(patch, { travelDate: date, departAt: dep, arriveAt: arr });
  }
  if (input.busId !== undefined || input.capacityOverride !== undefined) {
    const bus = input.busId ? await db.query.buses.findFirst({ where: eq(schema.buses.id, input.busId) }) : t.bus;
    if (!bus) throw badRequest("Bus not found");
    const cap = (input.capacityOverride !== undefined ? input.capacityOverride : t.capacityOverride) ?? bus.capacity;
    const occ = (await tripOccupancy([id])).get(id)!;
    if (cap < occ.booked) throw badRequest(`Capacity ${cap} is below the ${occ.booked} passengers already booked`);
    if (input.busId) patch.busId = input.busId;
    if (input.capacityOverride !== undefined) patch.capacityOverride = input.capacityOverride;
  }
  await db.update(schema.trips).set({ ...patch, updatedAt: new Date() }).where(eq(schema.trips.id, id));
  await audit(db, actor, "trip.update", "trip", id, input);
  return { data: await getTripDetail(id) };
});
