// Excel Cabs — Local Bus Booking & Management System
// Data model follows SDD section 6.
//  - UUID primary keys (non-guessable)
//  - Money stored as NUMERIC(10,2); handled as integer paise in code (see lib/money.ts)
//  - All timestamps are timestamptz; displayed in APP_TIMEZONE
import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, numeric, date, jsonb,
  index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["ADMIN", "STAFF", "TRIP_STAFF"]);
export const tripStatusEnum = pgEnum("trip_status", ["SCHEDULED", "OPEN", "COMPLETED", "CANCELLED"]);
export const bookingStatusEnum = pgEnum("booking_status", ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"]);
export const paymentStatusEnum = pgEnum("payment_status", ["UNPAID", "PARTIAL", "PAID", "POST_TRAVEL", "REFUNDED", "PARTIAL_REFUND"]);
export const bookingSourceEnum = pgEnum("booking_source", ["ONLINE", "WHATSAPP", "PHONE", "COUNTER"]);
export const paymentMethodEnum = pgEnum("payment_method", ["UPI", "CASH", "BANK", "OTHER"]);
export const paymentKindEnum = pgEnum("payment_kind", ["PAYMENT", "REFUND"]);
export const boardingStatusEnum = pgEnum("boarding_status", ["NOT_CHECKED", "BOARDED", "NO_SHOW"]);
export const refundStatusEnum = pgEnum("refund_status", ["NONE", "PENDING", "PARTIAL", "REFUNDED"]);

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("STAFF"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: ts("last_login_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const buses = pgTable("buses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  registration: text("registration").notNull().unique(),
  capacity: integer("capacity").notNull(),
  type: text("type").notNull(), // "AC Seater", "Non-AC Seater", "Mini Bus" ...
  seatLayout: text("seat_layout"), // "2+2" | "2+1" | null => count-only booking
  amenities: text("amenities").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const routes = pgTable("routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  distanceKm: integer("distance_km"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("routes_od_idx").on(t.origin, t.destination)]);

export const routeStops = pgTable("route_stops", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id").notNull().references(() => routes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  landmark: text("landmark"),
  sequence: integer("sequence").notNull(),
  offsetMinutes: integer("offset_minutes").notNull().default(0), // minutes after departure
  isBoarding: boolean("is_boarding").notNull().default(true),
  isDropoff: boolean("is_dropoff").notNull().default(true),
}, (t) => [uniqueIndex("route_stops_route_seq_uq").on(t.routeId, t.sequence)]);

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id").notNull().references(() => routes.id),
  busId: uuid("bus_id").notNull().references(() => buses.id),
  travelDate: date("travel_date", { mode: "string" }).notNull(), // YYYY-MM-DD (local date)
  departAt: ts("depart_at").notNull(),
  arriveAt: ts("arrive_at").notNull(),
  fare: money("fare").notNull(),
  status: tripStatusEnum("status").notNull().default("OPEN"),
  capacityOverride: integer("capacity_override"),
  notes: text("notes"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("trips_date_route_idx").on(t.travelDate, t.routeId), index("trips_status_idx").on(t.status)]);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: text("reference").notNull().unique(),
  tripId: uuid("trip_id").notNull().references(() => trips.id),
  source: bookingSourceEnum("source").notNull().default("ONLINE"),
  status: bookingStatusEnum("status").notNull().default("CONFIRMED"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("UNPAID"),
  postTravel: boolean("post_travel").notNull().default(false),
  totalFare: money("total_fare").notNull(),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  contactEmail: text("contact_email"),
  boardingStopId: uuid("boarding_stop_id").references(() => routeStops.id),
  dropStopId: uuid("drop_stop_id").references(() => routeStops.id),
  notes: text("notes"),
  createdById: uuid("created_by_id").references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [
  index("bookings_trip_status_idx").on(t.tripId, t.status),
  index("bookings_phone_idx").on(t.contactPhone),
  index("bookings_created_idx").on(t.createdAt),
]);

export const passengers = pgTable("passengers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  age: integer("age"),
  gender: text("gender"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("passengers_phone_idx").on(t.phone)]);

export const bookingPassengers = pgTable("booking_passengers", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  passengerId: uuid("passenger_id").notNull().references(() => passengers.id),
  seatNumber: text("seat_number"),
  fare: money("fare").notNull(),
  boarding: boardingStatusEnum("boarding").notNull().default("NOT_CHECKED"),
  boardedAt: ts("boarded_at"),
}, (t) => [index("bp_booking_idx").on(t.bookingId)]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  kind: paymentKindEnum("kind").notNull().default("PAYMENT"),
  amount: money("amount").notNull(),
  method: paymentMethodEnum("method").notNull(),
  txnReference: text("txn_reference"),
  note: text("note"),
  receivedAt: ts("received_at").notNull().defaultNow(),
  recordedById: uuid("recorded_by_id").references(() => users.id),
  voidedAt: ts("voided_at"),
  voidReason: text("void_reason"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("payments_booking_idx").on(t.bookingId), index("payments_received_idx").on(t.receivedAt)]);

export const cancellations = pgTable("cancellations", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().unique().references(() => bookings.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  cancelledById: uuid("cancelled_by_id").references(() => users.id),
  cancelledAt: ts("cancelled_at").notNull().defaultNow(),
  refundAmount: money("refund_amount").notNull().default("0"),
  refundStatus: refundStatusEnum("refund_status").notNull().default("NONE"),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => users.id),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  changes: jsonb("changes"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("audit_entity_idx").on(t.entity, t.entityId), index("audit_created_idx").on(t.createdAt)]);

// ---------- relations (for db.query.* with nested reads) ----------
export const routesRel = relations(routes, ({ many }) => ({ stops: many(routeStops), trips: many(trips) }));
export const routeStopsRel = relations(routeStops, ({ one }) => ({ route: one(routes, { fields: [routeStops.routeId], references: [routes.id] }) }));
export const busesRel = relations(buses, ({ many }) => ({ trips: many(trips) }));
export const tripsRel = relations(trips, ({ one, many }) => ({
  route: one(routes, { fields: [trips.routeId], references: [routes.id] }),
  bus: one(buses, { fields: [trips.busId], references: [buses.id] }),
  bookings: many(bookings),
}));
export const bookingsRel = relations(bookings, ({ one, many }) => ({
  trip: one(trips, { fields: [bookings.tripId], references: [trips.id] }),
  boardingStop: one(routeStops, { fields: [bookings.boardingStopId], references: [routeStops.id]}),
  dropStop: one(routeStops, { fields: [bookings.dropStopId], references: [routeStops.id]}),
  createdBy: one(users, { fields: [bookings.createdById], references: [users.id] }),
  passengers: many(bookingPassengers),
  payments: many(payments),
  cancellation: one(cancellations, { fields: [bookings.id], references: [cancellations.bookingId] }),
}));
export const bookingPassengersRel = relations(bookingPassengers, ({ one }) => ({
  booking: one(bookings, { fields: [bookingPassengers.bookingId], references: [bookings.id] }),
  passenger: one(passengers, { fields: [bookingPassengers.passengerId], references: [passengers.id] }),
}));
export const paymentsRel = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
  recordedBy: one(users, { fields: [payments.recordedById], references: [users.id] }),
}));
export const cancellationsRel = relations(cancellations, ({ one }) => ({
  booking: one(bookings, { fields: [cancellations.bookingId], references: [bookings.id] }),
  cancelledBy: one(users, { fields: [cancellations.cancelledById], references: [users.id] }),
}));
