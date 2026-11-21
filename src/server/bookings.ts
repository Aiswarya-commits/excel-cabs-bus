import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/db";
import { fromPaise, toPaise } from "@/lib/money";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { brand } from "@/lib/brand";
import { seatLabels } from "@/lib/seats";
import type { Actor } from "@/lib/auth";
import type { z } from "zod";
import type { cancelSchema, createBookingSchema, paymentSchema, updateBookingSchema } from "@/lib/validation";
import { audit } from "./audit";

const { trips, buses, routeStops, bookings, passengers, bookingPassengers, payments, cancellations } = schema;


// Human-readable, unambiguous booking reference: EX + 6 chars (no 0/O/1/I/L)
const ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function newReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "EX" + Array.from(bytes, (b) => ALPHA[b % ALPHA.length]).join("");
}

export { derivePayment } from "@/lib/payment";
import { derivePayment } from "@/lib/payment";

async function recomputePaymentStatus(tx: Tx, bookingId: string) {
  const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
  const entries = await tx.select().from(payments).where(eq(payments.bookingId, bookingId));
  const d = derivePayment(toPaise(b.totalFare), entries, b.status, b.postTravel);
  if (d.status !== b.paymentStatus) await tx.update(bookings).set({ paymentStatus: d.status, updatedAt: new Date() }).where(eq(bookings.id, bookingId));
  return d;
}

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/**
 * Creates a booking inside a transaction. The trip row is locked with
 * SELECT … FOR UPDATE so concurrent requests are serialised and capacity can
 * never be exceeded (SDD §6.2, §11 Overbooking).
 */
export async function createBooking(input: CreateBookingInput, actor: Actor | null) {
  const isStaff = !!actor && actor.role !== "TRIP_STAFF";
  if (input.website) throw badRequest("Invalid submission"); // bot honeypot
  if (!isStaff && input.passengers.length > brand.maxPassengersPerBooking)
    throw badRequest(`Maximum ${brand.maxPassengersPerBooking} passengers per online booking. Please contact us for group bookings.`);

  return db.transaction(async (tx) => {
    // 1. Lock trip row
    const locked = await tx.execute<{ id: string }>(sql`SELECT id FROM trips WHERE id = ${input.tripId} FOR UPDATE`);
    if (!locked.rows.length) throw notFound("Trip not found");
    const [row] = await tx.select({ trip: trips, bus: buses }).from(trips).innerJoin(buses, eq(buses.id, trips.busId)).where(eq(trips.id, input.tripId));
    const { trip, bus } = row;

    // 2. Validate trip status / timing
    const allowed = isStaff ? ["OPEN", "SCHEDULED"] : ["OPEN"];
    if (!allowed.includes(trip.status)) throw conflict("This trip is not open for booking", "TRIP_CLOSED");
    if (!isStaff && Date.now() > trip.departAt.getTime() - brand.bookingCutoffMinutes * 60000)
      throw conflict("Online booking has closed for this trip. Please call us.", "BOOKING_CUTOFF");

    // 3. Capacity check (cancelled bookings don't count)
    const capacity = trip.capacityOverride ?? bus.capacity;
    const occ = await tx.select({ seat: bookingPassengers.seatNumber }).from(bookingPassengers)
      .innerJoin(bookings, eq(bookings.id, bookingPassengers.bookingId))
      .where(and(eq(bookings.tripId, trip.id), ne(bookings.status, "CANCELLED")));
    const n = input.passengers.length;
    const left = capacity - occ.length;
    if (n > left) throw conflict(left <= 0 ? "Sorry, this trip is full." : `Only ${left} seat${left === 1 ? "" : "s"} left on this trip.`, "CAPACITY", { available: Math.max(0, left) });

    // 4. Seats (only when the bus uses a seat layout). Missing seats are auto-assigned.
    const seatsForPax: (string | null)[] = input.passengers.map((p) => p.seatNumber ?? null);
    if (bus.seatLayout) {
      const valid = new Set(seatLabels(capacity));
      const taken = new Set(occ.map((o) => o.seat).filter(Boolean) as string[]);
      const chosen = seatsForPax.filter(Boolean) as string[];
      if (new Set(chosen).size !== chosen.length) throw badRequest("The same seat was selected twice");
      for (const s of chosen) {
        if (!valid.has(s)) throw badRequest(`Seat ${s} does not exist on this bus`);
        if (taken.has(s)) throw conflict(`Seat ${s} was just booked by someone else. Please pick another seat.`, "SEAT_TAKEN", { seat: s });
      }
      chosen.forEach((s) => taken.add(s));
      const free = [...valid].filter((s) => !taken.has(s));
      for (let i = 0; i < seatsForPax.length; i++) if (!seatsForPax[i]) seatsForPax[i] = free.shift() ?? null;
    } else seatsForPax.fill(null);

    // 5. Stops must belong to the route, in travel order
    const stops = await tx.select().from(routeStops).where(eq(routeStops.routeId, trip.routeId)).orderBy(asc(routeStops.sequence));
    const board = input.boardingStopId ? stops.find((s) => s.id === input.boardingStopId) : stops[0];
    const drop = input.dropStopId ? stops.find((s) => s.id === input.dropStopId) : stops[stops.length - 1];
    if (!board || !board.isBoarding) throw badRequest("Invalid boarding point");
    if (!drop || !drop.isDropoff) throw badRequest("Invalid drop-off point");
    if (board.sequence >= drop.sequence) throw badRequest("Drop-off point must be after the boarding point");

    // 6. Duplicate warning: same phone already booked on this trip
    if (!input.allowDuplicate) {
      const dup = await tx.select({ reference: bookings.reference }).from(bookings)
        .where(and(eq(bookings.tripId, trip.id), eq(bookings.contactPhone, input.contactPhone), ne(bookings.status, "CANCELLED"))).limit(1);
      if (dup.length) throw conflict(`A booking (${dup[0].reference}) already exists for this phone number on this trip.`, "DUPLICATE", { reference: dup[0].reference });
    }

    // 7. Fare (fixed per trip; staff may override per passenger e.g. child/discount)
    const farePax = isStaff && input.farePerPassenger ? toPaise(input.farePerPassenger) : toPaise(trip.fare);
    const total = farePax * n;

    // 8. Unique reference
    let reference = newReference();
    for (let i = 0; i < 5; i++) {
      const ex = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.reference, reference)).limit(1);
      if (!ex.length) break; reference = newReference();
    }

    const status = isStaff ? (input.status ?? "CONFIRMED") : (brand.onlineAutoConfirm ? "CONFIRMED" : "PENDING");
    const [b] = await tx.insert(bookings).values({
      reference, tripId: trip.id, source: isStaff ? (input.source ?? "COUNTER") : "ONLINE", status,
      postTravel: isStaff ? !!input.postTravel : false, totalFare: fromPaise(total),
      contactName: input.contactName, contactPhone: input.contactPhone, contactEmail: input.contactEmail,
      boardingStopId: board.id, dropStopId: drop.id, notes: input.notes, createdById: actor?.id ?? null,
    }).returning();

    for (let i = 0; i < n; i++) {
      const p = input.passengers[i];
      const [px] = await tx.insert(passengers).values({ name: p.name, phone: i === 0 ? input.contactPhone : null, age: p.age ?? null, gender: p.gender ?? null }).returning({ id: passengers.id });
      await tx.insert(bookingPassengers).values({ bookingId: b.id, passengerId: px.id, seatNumber: seatsForPax[i], fare: fromPaise(farePax) });
    }

    if (isStaff && input.initialPayment && toPaise(input.initialPayment.amount) > 0) {
      await tx.insert(payments).values({ bookingId: b.id, amount: input.initialPayment.amount, method: input.initialPayment.method, txnReference: input.initialPayment.txnReference, recordedById: actor!.id });
    }
    await recomputePaymentStatus(tx, b.id);
    await audit(tx, actor, "booking.create", "booking", b.id, { reference, source: b.source, passengers: n, total: fromPaise(total), seats: seatsForPax });
    return { id: b.id, reference };
  });
}

/** Full booking with trip, passengers, payments, cancellation and computed balance. */
export async function getBooking(where: { id?: string; reference?: string }) {
  const b = await db.query.bookings.findFirst({
    where: where.id ? eq(bookings.id, where.id) : eq(bookings.reference, where.reference!.toUpperCase()),
    with: {
      trip: { with: { route: true, bus: true } }, boardingStop: true, dropStop: true,
      passengers: { with: { passenger: true } }, payments: { orderBy: desc(payments.receivedAt), with: { recordedBy: { columns: { name: true } } } },
      cancellation: { with: { cancelledBy: { columns: { name: true } } } }, createdBy: { columns: { name: true } },
    },
  });
  if (!b) throw notFound("Booking not found");
  const { paid, refunded, net, balance } = derivePayment(toPaise(b.totalFare), b.payments, b.status, b.postTravel);
  const tripDepart = b.trip.departAt.getTime();
  return {
    ...b,
    passengers: [...b.passengers].sort((x, y) => (Number(x.seatNumber) || 0) - (Number(y.seatNumber) || 0)),
    totalPaise: toPaise(b.totalFare), paid, refunded, net, balance,
    boardingTime: b.boardingStop ? new Date(tripDepart + b.boardingStop.offsetMinutes * 60000) : b.trip.departAt,
  };
}
export type FullBooking = Awaited<ReturnType<typeof getBooking>>;

export async function updateBooking(id: string, input: z.infer<typeof updateBookingSchema>, actor: Actor) {
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, id)).for("update");
    if (!b) throw notFound("Booking not found");
    if (b.status === "CANCELLED") throw conflict("Cancelled bookings cannot be edited");
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const patch: Partial<typeof bookings.$inferInsert> = {};
    for (const k of ["contactName", "contactPhone", "contactEmail", "notes", "status", "postTravel", "boardingStopId", "dropStopId"] as const) {
      if (input[k] !== undefined && input[k] !== b[k]) { changes[k] = { from: b[k], to: input[k] }; (patch as Record<string, unknown>)[k] = input[k]; }
    }
    if (patch.boardingStopId !== undefined || patch.dropStopId !== undefined) {
      const [trip] = await tx.select().from(trips).where(eq(trips.id, b.tripId));
      const stops = await tx.select().from(routeStops).where(eq(routeStops.routeId, trip.routeId));
      const bs = stops.find((s) => s.id === (patch.boardingStopId ?? b.boardingStopId));
      const ds = stops.find((s) => s.id === (patch.dropStopId ?? b.dropStopId));
      if (!bs || !ds || bs.sequence >= ds.sequence) throw badRequest("Invalid boarding / drop-off combination");
    }
    if (Object.keys(patch).length) await tx.update(bookings).set({ ...patch, updatedAt: new Date() }).where(eq(bookings.id, id));

    if (input.passengers?.length) {
      const [trip] = await tx.select({ trip: trips, bus: buses }).from(trips).innerJoin(buses, eq(buses.id, trips.busId)).where(eq(trips.id, b.tripId));
      await tx.execute(sql`SELECT id FROM trips WHERE id = ${b.tripId} FOR UPDATE`);
      const current = await tx.select().from(bookingPassengers).where(eq(bookingPassengers.bookingId, id));
      for (const p of input.passengers) {
        const cur = current.find((c) => c.id === p.id); if (!cur) throw badRequest("Passenger does not belong to this booking");
        if (p.seatNumber !== undefined && p.seatNumber !== cur.seatNumber) {
          if (!trip.bus.seatLayout) throw badRequest("This bus does not use seat numbers");
          if (p.seatNumber) {
            const cap = trip.trip.capacityOverride ?? trip.bus.capacity;
            if (!seatLabels(cap).includes(p.seatNumber)) throw badRequest(`Seat ${p.seatNumber} does not exist`);
            const clash = await tx.select({ id: bookingPassengers.id }).from(bookingPassengers).innerJoin(bookings, eq(bookings.id, bookingPassengers.bookingId))
              .where(and(eq(bookings.tripId, b.tripId), ne(bookings.status, "CANCELLED"), eq(bookingPassengers.seatNumber, p.seatNumber), ne(bookingPassengers.id, p.id)));
            if (clash.length) throw conflict(`Seat ${p.seatNumber} is already taken`, "SEAT_TAKEN");
          }
          await tx.update(bookingPassengers).set({ seatNumber: p.seatNumber }).where(eq(bookingPassengers.id, p.id));
          changes[`seat:${p.id}`] = { from: cur.seatNumber, to: p.seatNumber };
        }
        if (p.name || p.age !== undefined) {
          const [px] = await tx.select().from(passengers).where(eq(passengers.id, cur.passengerId));
          const pp: Record<string, unknown> = {};
          if (p.name && p.name !== px.name) { pp.name = p.name; changes[`name:${p.id}`] = { from: px.name, to: p.name }; }
          if (p.age !== undefined && p.age !== px.age) { pp.age = p.age; changes[`age:${p.id}`] = { from: px.age, to: p.age }; }
          if (Object.keys(pp).length) await tx.update(passengers).set(pp).where(eq(passengers.id, px.id));
        }
      }
    }
    await recomputePaymentStatus(tx, id);
    if (Object.keys(changes).length) await audit(tx, actor, "booking.update", "booking", id, changes);
    return { ok: true, changed: Object.keys(changes) };
  });
}

export async function cancelBooking(id: string, input: z.infer<typeof cancelSchema>, actor: Actor) {
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, id)).for("update");
    if (!b) throw notFound("Booking not found");
    if (b.status === "CANCELLED") throw conflict("Booking is already cancelled");
    const entries = await tx.select().from(payments).where(eq(payments.bookingId, id));
    const { net } = derivePayment(toPaise(b.totalFare), entries, b.status, b.postTravel);
    const refund = toPaise(input.refundAmount);
    if (refund > net) throw badRequest(`Refund cannot exceed amount received (₹${fromPaise(net)})`);
    await tx.update(bookings).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(bookings.id, id));
    await tx.insert(cancellations).values({ bookingId: id, reason: input.reason, cancelledById: actor.id, refundAmount: fromPaise(refund), refundStatus: refund > 0 ? input.refundStatus === "NONE" ? "PENDING" : input.refundStatus : "NONE" });
    if (refund > 0 && input.refundStatus === "REFUNDED") {
      await tx.insert(payments).values({ bookingId: id, kind: "REFUND", amount: fromPaise(refund), method: input.refundMethod ?? "UPI", note: "Refund on cancellation", recordedById: actor.id });
    }
    await recomputePaymentStatus(tx, id);
    await audit(tx, actor, "booking.cancel", "booking", id, { reason: input.reason, refund: fromPaise(refund) });
    return { ok: true };
  });
}

export async function addPayment(bookingId: string, input: z.infer<typeof paymentSchema>, actor: Actor) {
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!b) throw notFound("Booking not found");
    const entries = await tx.select().from(payments).where(eq(payments.bookingId, bookingId));
    const cur = derivePayment(toPaise(b.totalFare), entries, b.status, b.postTravel);
    const amt = toPaise(input.amount);
    if (input.kind === "PAYMENT" && b.status === "CANCELLED") throw conflict("Cannot record a payment on a cancelled booking");
    if (input.kind === "PAYMENT" && amt > cur.balance) throw badRequest(`Amount exceeds balance due (₹${fromPaise(cur.balance)})`);
    if (input.kind === "REFUND" && amt > cur.net) throw badRequest(`Refund exceeds amount received (₹${fromPaise(cur.net)})`);
    const [p] = await tx.insert(payments).values({
      bookingId, kind: input.kind, amount: fromPaise(amt), method: input.method, txnReference: input.txnReference, note: input.note,
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(), recordedById: actor.id,
    }).returning();
    if (input.kind === "REFUND") {
      const [c] = await tx.select().from(cancellations).where(eq(cancellations.bookingId, bookingId));
      if (c) {
        const refundedNow = cur.refunded + amt;
        await tx.update(cancellations).set({ refundStatus: refundedNow >= toPaise(c.refundAmount) ? "REFUNDED" : "PARTIAL" }).where(eq(cancellations.id, c.id));
      }
    }
    const d = await recomputePaymentStatus(tx, bookingId);
    await audit(tx, actor, `payment.${input.kind.toLowerCase()}`, "booking", bookingId, { paymentId: p.id, amount: fromPaise(amt), method: input.method, ref: input.txnReference });
    return { payment: p, ...d };
  });
}

/** Payments are never deleted — they are voided with a reason so history is kept (SDD §4.3). */
export async function voidPayment(paymentId: string, reason: string, actor: Actor) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!p) throw notFound("Payment not found");
    if (p.voidedAt) throw conflict("Payment already voided");
    await tx.update(payments).set({ voidedAt: new Date(), voidReason: reason }).where(eq(payments.id, paymentId));
    const d = await recomputePaymentStatus(tx, p.bookingId);
    await audit(tx, actor, "payment.void", "booking", p.bookingId, { paymentId, amount: p.amount, reason });
    return d;
  });
}

export async function setBoarding(bpId: string, status: "NOT_CHECKED" | "BOARDED" | "NO_SHOW", actor: Actor) {
  return db.transaction(async (tx) => {
    const [bp] = await tx.select().from(bookingPassengers).where(eq(bookingPassengers.id, bpId));
    if (!bp) throw notFound("Passenger not found");
    await tx.update(bookingPassengers).set({ boarding: status, boardedAt: status === "BOARDED" ? new Date() : null }).where(eq(bookingPassengers.id, bpId));
    await audit(tx, actor, "passenger.boarding", "booking", bp.bookingId, { bookingPassengerId: bpId, from: bp.boarding, to: status });
    return { ok: true };
  });
}

/** Trip manifest: all active bookings + passengers, ordered by seat / boarding stop. */
export async function tripManifest(tripId: string) {
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId), with: { route: { with: { stops: { orderBy: asc(routeStops.sequence) } } }, bus: true } });
  if (!trip) throw notFound("Trip not found");
  const list = await db.query.bookings.findMany({
    where: eq(bookings.tripId, tripId), orderBy: asc(bookings.createdAt),
    with: { passengers: { with: { passenger: true } }, payments: true, boardingStop: true, dropStop: true },
  });
  const rows = list.map((b) => ({ ...b, money: derivePayment(toPaise(b.totalFare), b.payments, b.status, b.postTravel) }));
  const active = rows.filter((r) => r.status !== "CANCELLED");
  const capacity = trip.capacityOverride ?? trip.bus.capacity;
  const pax = active.reduce((s, r) => s + r.passengers.length, 0);
  return {
    trip, capacity, bookings: rows,
    totals: {
      bookings: active.length, passengers: pax, available: capacity - pax,
      boarded: active.reduce((s, r) => s + r.passengers.filter((p) => p.boarding === "BOARDED").length, 0),
      fare: active.reduce((s, r) => s + toPaise(r.totalFare), 0),
      collected: active.reduce((s, r) => s + r.money.net, 0),
      outstanding: active.reduce((s, r) => s + r.money.balance, 0),
    },
  };
}

export async function findDuplicates(tripId: string, phone: string) {
  return db.select({ id: bookings.id, reference: bookings.reference, contactName: bookings.contactName, status: bookings.status })
    .from(bookings).where(and(eq(bookings.tripId, tripId), eq(bookings.contactPhone, phone), ne(bookings.status, "CANCELLED")));
}

export async function bookingsByIds(ids: string[]) {
  return ids.length ? db.select().from(bookings).where(inArray(bookings.id, ids)) : [];
}
