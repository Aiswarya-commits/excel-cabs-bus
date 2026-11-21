import { and, asc, eq, inArray, ne, sql, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { toPaise } from "@/lib/money";
import { notFound } from "@/lib/errors";
import { brand } from "@/lib/brand";

const { trips, buses, routes, routeStops, bookings, bookingPassengers } = schema;

/** Booked passenger count + taken seats for each trip (cancelled bookings excluded — SDD §6.2). */
export async function tripOccupancy(tripIds: string[]) {
  const out = new Map<string, { booked: number; seats: string[] }>();
  tripIds.forEach((id) => out.set(id, { booked: 0, seats: [] }));
  if (!tripIds.length) return out;
  const rows = await db.select({ tripId: bookings.tripId, seat: bookingPassengers.seatNumber })
    .from(bookingPassengers).innerJoin(bookings, eq(bookings.id, bookingPassengers.bookingId))
    .where(and(inArray(bookings.tripId, tripIds), ne(bookings.status, "CANCELLED")));
  for (const r of rows) {
    const o = out.get(r.tripId)!; o.booked++; if (r.seat) o.seats.push(r.seat);
  }
  return out;
}

/** All place names passengers can search (route ends + boarding/drop stops). */
export async function listPlaces(): Promise<string[]> {
  const rows = await db.selectDistinct({ name: routeStops.name }).from(routeStops)
    .innerJoin(routes, eq(routes.id, routeStops.routeId)).where(eq(routes.active, true));
  const ends = await db.select({ o: routes.origin, d: routes.destination }).from(routes).where(eq(routes.active, true));
  const set = new Set<string>(rows.map((r) => r.name));
  ends.forEach((e) => { set.add(e.o); set.add(e.d); });
  return [...set].sort((a, b) => a.localeCompare(b));
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Search trips by from/to/date. Matches whole routes AND intermediate stops
 * (e.g. a passenger can book Stop 2 → Stop 5 on a longer route).
 */
export async function searchTrips(from: string, to: string, date: string) {
  const f = norm(from), t = norm(to);
  const allRoutes = await db.query.routes.findMany({
    where: eq(routes.active, true), with: { stops: { orderBy: asc(routeStops.sequence) } },
  });
  const matches = new Map<string, { board: typeof routeStops.$inferSelect; drop: typeof routeStops.$inferSelect; dropIsLast: boolean }>();
  for (const r of allRoutes) {
    const board = r.stops.find((s) => norm(s.name) === f && s.isBoarding)
      ?? (norm(r.origin) === f ? r.stops[0] : undefined);
    const drop = [...r.stops].reverse().find((s) => norm(s.name) === t && s.isDropoff)
      ?? (norm(r.destination) === t ? r.stops[r.stops.length - 1] : undefined);
    if (board && drop && board.sequence < drop.sequence) matches.set(r.id, { board, drop, dropIsLast: drop.id === r.stops[r.stops.length - 1]?.id });
  }
  if (!matches.size) return [];

  const list = await db.query.trips.findMany({
    where: and(inArray(trips.routeId, [...matches.keys()]), eq(trips.travelDate, date), inArray(trips.status, ["OPEN", "SCHEDULED"])),
    with: { bus: true, route: true },
    orderBy: asc(trips.departAt),
  });
  const occ = await tripOccupancy(list.map((x) => x.id));
  const now = Date.now();
  return list.map((x) => {
    const m = matches.get(x.routeId)!;
    const capacity = x.capacityOverride ?? x.bus.capacity;
    const booked = occ.get(x.id)!.booked;
    const departAt = new Date(x.departAt.getTime() + m.board.offsetMinutes * 60000);
    const arriveAt = m.dropIsLast ? x.arriveAt : new Date(x.departAt.getTime() + m.drop.offsetMinutes * 60000);
    const cutoff = departAt.getTime() - brand.bookingCutoffMinutes * 60000;
    return {
      id: x.id, routeName: x.route.name, travelDate: x.travelDate, status: x.status,
      departAt, arriveAt, fare: toPaise(x.fare),
      bus: { name: x.bus.name, type: x.bus.type, registration: x.bus.registration, amenities: x.bus.amenities, seatLayout: x.bus.seatLayout },
      boardingStop: { id: m.board.id, name: m.board.name }, dropStop: { id: m.drop.id, name: m.drop.name },
      capacity, booked, available: Math.max(0, capacity - booked),
      bookable: x.status === "OPEN" && now < cutoff && capacity - booked > 0,
    };
  });
}

/** Trip detail for booking screen (public-safe). */
export async function getTripDetail(id: string) {
  const x = await db.query.trips.findFirst({
    where: eq(trips.id, id),
    with: { bus: true, route: { with: { stops: { orderBy: asc(routeStops.sequence) } } } },
  });
  if (!x) throw notFound("Trip not found");
  const occ = (await tripOccupancy([x.id])).get(x.id)!;
  const capacity = x.capacityOverride ?? x.bus.capacity;
  const cutoff = x.departAt.getTime() - brand.bookingCutoffMinutes * 60000;
  return {
    id: x.id, status: x.status, travelDate: x.travelDate, departAt: x.departAt, arriveAt: x.arriveAt,
    fare: toPaise(x.fare), notes: x.notes,
    route: { id: x.route.id, name: x.route.name, origin: x.route.origin, destination: x.route.destination, distanceKm: x.route.distanceKm },
    stops: x.route.stops.map((s) => ({
      id: s.id, name: s.name, landmark: s.landmark, sequence: s.sequence, isBoarding: s.isBoarding, isDropoff: s.isDropoff,
      time: new Date(x.departAt.getTime() + s.offsetMinutes * 60000),
    })),
    bus: { id: x.bus.id, name: x.bus.name, type: x.bus.type, registration: x.bus.registration, amenities: x.bus.amenities, seatLayout: x.bus.seatLayout },
    capacity, booked: occ.booked, available: Math.max(0, capacity - occ.booked), takenSeats: occ.seats,
    bookable: x.status === "OPEN" && Date.now() < cutoff && capacity - occ.booked > 0,
  };
}

/** Upcoming popular routes for the home page. */
export async function popularRoutes(limit = 6) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rows = await db.select({
    origin: routes.origin, destination: routes.destination,
    minFare: sql<string>`min(${trips.fare})`, tripCount: sql<number>`count(${trips.id})::int`,
  }).from(routes).innerJoin(trips, eq(trips.routeId, routes.id))
    .where(and(eq(routes.active, true), eq(trips.status, "OPEN"), gte(trips.departAt, today)))
    .groupBy(routes.origin, routes.destination).orderBy(sql`count(${trips.id}) desc`).limit(limit);
  return rows.map((r) => ({ ...r, minFare: toPaise(r.minFare) }));
}

