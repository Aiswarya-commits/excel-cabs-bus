import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, jsonBody, pageParams, clientIp } from "@/lib/api";
import { getActor, requireRole, ALL_STAFF } from "@/lib/auth";
import { createBookingSchema, normalisePhone } from "@/lib/validation";
import { rateLimit } from "@/lib/ratelimit";
import { ticketKey } from "@/lib/jwt";
import { toPaise } from "@/lib/money";
import { createBooking, derivePayment } from "@/server/bookings";

const { bookings, trips, routes, payments, bookingPassengers } = schema;

// POST /bookings — passenger (public) or staff booking
export const POST = handle(async (req) => {
  const actor = await getActor();
  if (!actor) rateLimit(`book:${clientIp(req)}`, 8, 60_000);
  const input = createBookingSchema.parse(await jsonBody(req));
  const r = await createBooking(input, actor);
  const k = await ticketKey(r.reference);
  return { data: { ...r, ticketUrl: `/ticket/${r.reference}?k=${k}` } };
});

// GET /bookings?q=&tripId=&date=&status=&paymentStatus=&source=&page=&pageSize=
export const GET = handle(async (req) => {
  await requireRole(...ALL_STAFF);
  const url = new URL(req.url); const s = url.searchParams; const { page, pageSize, offset } = pageParams(url);
  const conds: SQL[] = [];
  const q = s.get("q")?.trim();
  if (q) {
    const ph = normalisePhone(q);
    conds.push(or(ilike(bookings.reference, `%${q}%`), ilike(bookings.contactName, `%${q}%`), ph.length >= 4 ? ilike(bookings.contactPhone, `%${ph}%`) : sql`false`)!);
  }
  if (s.get("tripId")) conds.push(eq(bookings.tripId, s.get("tripId")!));
  if (s.get("date")) conds.push(eq(trips.travelDate, s.get("date")!));
  if (s.get("status")) conds.push(inArray(bookings.status, s.get("status")!.split(",") as "CONFIRMED"[]));
  if (s.get("paymentStatus")) conds.push(inArray(bookings.paymentStatus, s.get("paymentStatus")!.split(",") as "PAID"[]));
  if (s.get("source")) conds.push(inArray(bookings.source, s.get("source")!.split(",") as "ONLINE"[]));
  const where = conds.length ? and(...conds) : undefined;

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(bookings).innerJoin(trips, eq(trips.id, bookings.tripId)).where(where);
  const rows = await db.select({ b: bookings, travelDate: trips.travelDate, departAt: trips.departAt, routeName: routes.name })
    .from(bookings).innerJoin(trips, eq(trips.id, bookings.tripId)).innerJoin(routes, eq(routes.id, trips.routeId))
    .where(where).orderBy(desc(bookings.createdAt)).limit(pageSize).offset(offset);
  const ids = rows.map((r) => r.b.id);
  const pays = ids.length ? await db.select().from(payments).where(inArray(payments.bookingId, ids)) : [];
  const pax = ids.length ? await db.select({ bookingId: bookingPassengers.bookingId, c: sql<number>`count(*)::int`, seats: sql<string>`string_agg(${bookingPassengers.seatNumber}, ',')` }).from(bookingPassengers).where(inArray(bookingPassengers.bookingId, ids)).groupBy(bookingPassengers.bookingId) : [];
  return {
    data: rows.map(({ b, ...t }) => {
      const m = derivePayment(toPaise(b.totalFare), pays.filter((p) => p.bookingId === b.id), b.status, b.postTravel);
      const p = pax.find((x) => x.bookingId === b.id);
      return { id: b.id, reference: b.reference, status: b.status, paymentStatus: b.paymentStatus, source: b.source, contactName: b.contactName, contactPhone: b.contactPhone, createdAt: b.createdAt, total: toPaise(b.totalFare), paid: m.net, balance: m.balance, passengers: p?.c ?? 0, seats: p?.seats ?? null, ...t };
    }),
    meta: { page, pageSize, total },
  };
});
