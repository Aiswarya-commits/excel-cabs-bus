import { and, asc, between, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { toPaise } from "@/lib/money";
import { localToUtc, addDays } from "@/lib/time";
import { derivePayment, tripOccupancy } from "./index";

const { trips, bookings, payments } = schema;

/** Dashboard summary for a date range of travel dates (inclusive). */
export async function summary(from: string, to: string) {
  const tripRows = await db.query.trips.findMany({
    where: and(gte(trips.travelDate, from), lte(trips.travelDate, to)),
    with: { route: true, bus: true }, orderBy: asc(trips.departAt),
  });
  const tripIds = tripRows.map((t) => t.id);
  const occ = await tripOccupancy(tripIds);
  const bks = tripIds.length ? await db.query.bookings.findMany({ where: inArray(bookings.tripId, tripIds), with: { payments: true, passengers: true } }) : [];

  let passengers = 0, fare = 0, collected = 0, outstanding = 0, cancelled = 0, pending = 0;
  const byStatus: Record<string, number> = {}; const bySource: Record<string, number> = {};
  for (const b of bks) {
    const m = derivePayment(toPaise(b.totalFare), b.payments, b.status, b.postTravel);
    if (b.status === "CANCELLED") { cancelled++; continue; }
    if (b.status === "PENDING") pending++;
    passengers += b.passengers.length; fare += toPaise(b.totalFare); collected += m.net; outstanding += m.balance;
    byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
    bySource[b.source] = (bySource[b.source] ?? 0) + 1;
  }

  // Cash actually received in the window (by received date), regardless of travel date
  const start = localToUtc(from, "00:00"), end = localToUtc(addDays(to, 1), "00:00");
  const recv = await db.select({ kind: payments.kind, method: payments.method, total: sql<string>`sum(${payments.amount})` })
    .from(payments).where(and(between(payments.receivedAt, start, end), sql`${payments.voidedAt} is null`))
    .groupBy(payments.kind, payments.method);
  const receivedByMethod: Record<string, number> = {}; let receivedNet = 0;
  for (const r of recv) {
    const v = toPaise(r.total) * (r.kind === "REFUND" ? -1 : 1);
    receivedByMethod[r.method] = (receivedByMethod[r.method] ?? 0) + v; receivedNet += v;
  }

  return {
    range: { from, to },
    trips: tripRows.length,
    activeBookings: bks.length - cancelled, cancelled, pending, passengers,
    fare, collected, outstanding, receivedNet, receivedByMethod, byPaymentStatus: byStatus, bySource,
    tripList: tripRows.map((t) => {
      const o = occ.get(t.id)!; const cap = t.capacityOverride ?? t.bus.capacity;
      return { id: t.id, route: t.route.name, departAt: t.departAt, bus: t.bus.name, status: t.status, capacity: cap, booked: o.booked, travelDate: t.travelDate };
    }),
  };
}

/** Last N days trend of bookings created and money received. */
export async function trend(days = 7, endDate: string) {
  const out: { date: string; bookings: number; received: number }[] = [];
  const startDate = addDays(endDate, -(days - 1));
  const start = localToUtc(startDate, "00:00"), end = localToUtc(addDays(endDate, 1), "00:00");
  const tz = process.env.APP_TIMEZONE || "Asia/Kolkata";
  const b = await db.select({ d: sql<string>`to_char(${bookings.createdAt} at time zone ${tz}, 'YYYY-MM-DD')`, c: sql<number>`count(*)::int` })
    .from(bookings).where(and(between(bookings.createdAt, start, end), ne(bookings.status, "CANCELLED"))).groupBy(sql`1`);
  const p = await db.select({ d: sql<string>`to_char(${payments.receivedAt} at time zone ${tz}, 'YYYY-MM-DD')`, s: sql<string>`sum(case when ${payments.kind} = 'REFUND' then -${payments.amount} else ${payments.amount} end)` })
    .from(payments).where(and(between(payments.receivedAt, start, end), sql`${payments.voidedAt} is null`)).groupBy(sql`1`);
  for (let i = 0; i < days; i++) {
    const d = addDays(startDate, i);
    out.push({ date: d, bookings: b.find((x) => x.d === d)?.c ?? 0, received: toPaise(p.find((x) => x.d === d)?.s ?? "0") });
  }
  return out;
}

/** Per-trip report rows for CSV export. */
export async function tripReport(from: string, to: string) {
  const s = await summary(from, to);
  const ids = s.tripList.map((t) => t.id);
  const bks = ids.length ? await db.query.bookings.findMany({ where: and(inArray(bookings.tripId, ids), ne(bookings.status, "CANCELLED")), with: { payments: true } }) : [];
  return s.tripList.map((t) => {
    const mine = bks.filter((b) => b.tripId === t.id);
    let fare = 0, net = 0, bal = 0;
    for (const b of mine) { const m = derivePayment(toPaise(b.totalFare), b.payments, b.status, b.postTravel); fare += toPaise(b.totalFare); net += m.net; bal += m.balance; }
    return { ...t, bookings: mine.length, fare, collected: net, outstanding: bal };
  });
}
