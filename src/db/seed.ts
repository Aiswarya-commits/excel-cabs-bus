// Demo data — replace with the operator's real routes, buses, fares and schedules.
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { localToUtc, todayLocal, addDays } from "../lib/time";

type SeedDb = NodePgDatabase<typeof schema>;

const ROUTES = [
  { name: "Bengaluru → Mysuru", origin: "Bengaluru", destination: "Mysuru", km: 145, stops: [
    ["Bengaluru", "Majestic Bus Stand", 0], ["Kengeri", "Kengeri TTMC", 35], ["Ramanagara", "Bus Stand", 70],
    ["Channapatna", "Toy Town Circle", 90], ["Mandya", "Silver Jubilee Park", 130], ["Mysuru", "Suburban Bus Stand", 180]] },
  { name: "Bengaluru → Tumakuru", origin: "Bengaluru", destination: "Tumakuru", km: 70, stops: [
    ["Bengaluru", "Majestic Bus Stand", 0], ["Yeshwanthpur", "Metro Station", 20], ["Nelamangala", "Toll Gate", 45], ["Tumakuru", "KSRTC Stand", 100]] },
  { name: "Bengaluru → Hosur", origin: "Bengaluru", destination: "Hosur", km: 40, stops: [
    ["Bengaluru", "Shanthinagar TTMC", 0], ["Silk Board", "Junction", 20], ["Electronic City", "Infosys Gate", 40], ["Attibele", "Check Post", 60], ["Hosur", "Bus Stand", 80]] },
] as const;

const BUSES = [
  { name: "Excel Express 1", registration: "KA01AB1234", capacity: 40, type: "AC Seater", seatLayout: "2+2", amenities: ["AC", "Charging point", "Water bottle", "CCTV"] },
  { name: "Excel Express 2", registration: "KA01AB5678", capacity: 36, type: "AC Seater", seatLayout: "2+1", amenities: ["AC", "Charging point", "Reading light", "Push-back seats"] },
  { name: "Excel City Shuttle", registration: "KA05CD4321", capacity: 32, type: "Non-AC Seater", seatLayout: "2+2", amenities: ["CCTV", "Luggage rack"] },
  { name: "Excel Mini", registration: "KA03EF8765", capacity: 20, type: "Mini Bus (Tempo Traveller)", seatLayout: null, amenities: ["AC", "Charging point"] },
] as const;

const NAMES = ["Arjun Kumar", "Priya Sharma", "Rahul Nair", "Divya Rao", "Mohammed Irfan", "Sneha Reddy", "Karthik S", "Anitha Menon", "Vikram Singh", "Lakshmi Devi", "Suresh Babu", "Meera Iyer"];

/** Wipes all data and loads demo data into the given database. */
export async function seed(db: SeedDb) {
  console.log("Resetting data…");
  await db.execute(sql`TRUNCATE audit_logs, cancellations, payments, booking_passengers, passengers, bookings, trips, route_stops, routes, buses, users RESTART IDENTITY CASCADE`);

  const hash = (p: string) => bcrypt.hashSync(p, 10);
  const [admin, staff] = await db.insert(schema.users).values([
    { name: "Owner Admin", email: "admin@excelcabs.com", passwordHash: hash("Admin@123"), role: "ADMIN", phone: "9000000001" },
    { name: "Booking Desk", email: "staff@excelcabs.com", passwordHash: hash("Staff@123"), role: "STAFF", phone: "9000000002" },
    { name: "Conductor Ravi", email: "trip@excelcabs.com", passwordHash: hash("Trip@123"), role: "TRIP_STAFF", phone: "9000000003" },
  ]).returning();

  const buses = await db.insert(schema.buses).values(BUSES.map((b) => ({ ...b, amenities: [...b.amenities] }))).returning();

  const routeRows: { id: string; key: number; reverse: boolean; durationMin: number }[] = [];
  for (const [i, r] of ROUTES.entries()) {
    for (const reverse of [false, true]) {
      const stops = reverse ? [...r.stops].reverse() : [...r.stops];
      const total = r.stops[r.stops.length - 1][2];
      const [row] = await db.insert(schema.routes).values({
        name: reverse ? `${r.destination} → ${r.origin}` : r.name,
        origin: reverse ? r.destination : r.origin, destination: reverse ? r.origin : r.destination, distanceKm: r.km,
      }).returning();
      await db.insert(schema.routeStops).values(stops.map(([name, landmark, off], seq) => ({
        routeId: row.id, name, landmark, sequence: seq + 1, offsetMinutes: reverse ? total - off : off,
        isBoarding: seq < stops.length - 1, isDropoff: seq > 0,
      })));
      routeRows.push({ id: row.id, key: i, reverse, durationMin: total });
    }
  }

  // Schedules: departures per route per day, today + 14 days
  const SCHED: Record<number, { times: string[]; bus: number; fare: string }> = {
    0: { times: ["06:00", "09:30", "14:00", "18:30"], bus: 0, fare: "320.00" },
    1: { times: ["07:00", "13:00", "19:00"], bus: 2, fare: "150.00" },
    2: { times: ["06:30", "08:00", "17:30"], bus: 1, fare: "110.00" },
  };
  const today = todayLocal();
  const tripIds: { id: string; fare: string; cap: number; layout: string | null; date: string }[] = [];
  for (let d = -1; d < 14; d++) {
    const date = addDays(today, d);
    for (const r of routeRows) {
      const s = SCHED[r.key];
      for (const [ti, t] of s.times.entries()) {
        const busIdx = r.key === 0 && ti % 2 === 1 ? 1 : r.key === 2 && ti === 2 ? 3 : s.bus;
        const bus = buses[busIdx];
        const dep = localToUtc(date, t);
        const [trip] = await db.insert(schema.trips).values({
          routeId: r.id, busId: bus.id, travelDate: date, departAt: dep, arriveAt: new Date(dep.getTime() + r.durationMin * 60000),
          fare: bus.type.startsWith("AC") ? s.fare : (Number(s.fare) * 0.8).toFixed(2), status: d < 0 ? "COMPLETED" : "OPEN",
        }).returning();
        tripIds.push({ id: trip.id, fare: trip.fare, cap: bus.capacity, layout: bus.seatLayout, date });
      }
    }
  }

  // Sample bookings on today's & tomorrow's trips
  const sources = ["WHATSAPP", "PHONE", "COUNTER", "ONLINE"] as const;
  let n = 0;
  for (const t of tripIds.filter((x) => x.date === today || x.date === addDays(today, 1)).slice(0, 14)) {
    const count = 3 + (n % 5);
    let seat = 1;
    const stops = await db.select().from(schema.routeStops).where(sql`route_id = (select route_id from trips where id = ${t.id})`).orderBy(schema.routeStops.sequence);
    for (let k = 0; k < count; k++) {
      n++;
      const pax = 1 + (n % 3);
      const name = NAMES[n % NAMES.length];
      const phone = `98${String(45000000 + n * 7919).slice(0, 8)}`;
      const total = (Number(t.fare) * pax).toFixed(2);
      const src = sources[n % 4];
      const [b] = await db.insert(schema.bookings).values({
        reference: `EX${(100000 + n * 37).toString(36).toUpperCase().slice(-6).padStart(6, "2")}`,
        tripId: t.id, source: src, status: src === "ONLINE" && n % 2 ? "PENDING" : "CONFIRMED",
        totalFare: total, contactName: name, contactPhone: phone, postTravel: n % 6 === 0,
        boardingStopId: stops[0].id, dropStopId: stops[stops.length - 1].id, createdById: src === "ONLINE" ? null : staff.id,
      }).returning();
      for (let p = 0; p < pax; p++) {
        const [px] = await db.insert(schema.passengers).values({ name: p === 0 ? name : `${name.split(" ")[0]}'s companion ${p}`, phone: p === 0 ? phone : null }).returning();
        await db.insert(schema.bookingPassengers).values({ bookingId: b.id, passengerId: px.id, fare: t.fare, seatNumber: t.layout ? String(seat++) : null });
      }
      // Payments: mix of paid / partial / unpaid
      const mode = n % 4;
      let paid = 0;
      if (mode === 0) paid = Number(total);
      if (mode === 1) paid = Math.round(Number(total) / 2);
      if (paid) await db.insert(schema.payments).values({ bookingId: b.id, amount: paid.toFixed(2), method: n % 2 ? "UPI" : "CASH", txnReference: n % 2 ? `UPI${400000 + n}` : null, recordedById: staff.id });
      const status = paid >= Number(total) ? "PAID" : paid > 0 ? "PARTIAL" : b.postTravel ? "POST_TRAVEL" : "UNPAID";
      await db.update(schema.bookings).set({ paymentStatus: status }).where(sql`id = ${b.id}`);
      await db.insert(schema.auditLogs).values({ actorId: src === "ONLINE" ? null : staff.id, actorName: src === "ONLINE" ? "Passenger (online)" : staff.name, action: "booking.create", entity: "booking", entityId: b.id, changes: { seed: true } });
    }
  }
  console.log(`✔ Seeded: 3 users, ${buses.length} buses, ${routeRows.length} routes, ${tripIds.length} trips, ${n} bookings`);
  console.log("  Admin  → admin@excelcabs.com / Admin@123");
  console.log("  Staff  → staff@excelcabs.com / Staff@123");
  console.log("  Trip   → trip@excelcabs.com  / Trip@123");
  void admin;
}
