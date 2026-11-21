// End-to-end API tests against a running server (npm run dev / npm start).
//   BASE_URL=http://localhost:3000 npm test
// Requires seeded data (npm run db:seed). Covers SDD §13 acceptance criteria.
import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePayment } from "../src/lib/payment";
import { toPaise, fromPaise } from "../src/lib/money";
import { todayLocal, addDays } from "../src/lib/time";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ip = () => `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

async function call(path: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method: opts.method ?? "GET",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip(), ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}
const login = async (email: string, password: string) => (await call("/auth/login", { method: "POST", body: { email, password } })).json.token as string;
const phoneN = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;

test("unit: money & payment derivation (no floating point)", () => {
  assert.equal(toPaise("320.10"), 32010); assert.equal(fromPaise(32010), "320.10"); assert.equal(toPaise("0.1") + toPaise("0.2"), toPaise("0.3"));
  const e = (kind: string, amount: string, voided = false) => ({ kind, amount, voidedAt: voided ? new Date() : null });
  assert.equal(derivePayment(1000, [], "CONFIRMED", false).status, "UNPAID");
  assert.equal(derivePayment(1000, [], "CONFIRMED", true).status, "POST_TRAVEL");
  assert.equal(derivePayment(1000, [e("PAYMENT", "4.00")], "CONFIRMED", false).status, "PARTIAL");
  assert.equal(derivePayment(1000, [e("PAYMENT", "10.00")], "CONFIRMED", false).status, "PAID");
  assert.equal(derivePayment(1000, [e("PAYMENT", "10.00", true)], "CONFIRMED", false).balance, 1000);
  assert.equal(derivePayment(1000, [e("PAYMENT", "10.00"), e("REFUND", "10.00")], "CANCELLED", false).status, "REFUNDED");
});

test("auth & role-based access is enforced by the backend", async () => {
  assert.equal((await call("/bookings")).status, 401);
  assert.equal((await call("/auth/login", { method: "POST", body: { email: "admin@excelcabs.com", password: "wrong" } })).status, 401);
  const trip = await login("trip@excelcabs.com", "Trip@123");
  assert.equal((await call("/users", { token: trip })).status, 403);
  assert.equal((await call("/buses", { method: "POST", token: trip, body: {} })).status, 403);
  assert.equal((await call("/trips", { token: trip })).status, 200);
});

test("passenger search → book → ticket lookup, with validation", async () => {
  const date = addDays(todayLocal(), 3);
  const s = await call(`/trips/search?from=Bengaluru&to=Mysuru&date=${date}`);
  assert.equal(s.status, 200); assert.ok(s.json.data.length >= 1);
  // intermediate-stop search
  const mid = await call(`/trips/search?from=Ramanagara&to=Mandya&date=${date}`);
  assert.ok(mid.json.data.length >= 1, "stop-to-stop search works");
  const t = s.json.data[0];
  const detail = await call(`/trips/${t.id}`);
  const free = Array.from({ length: detail.json.data.capacity }, (_, i) => String(i + 1)).filter((x) => !detail.json.data.takenSeats.includes(x));
  const phone = phoneN();
  const bad = await call("/bookings", { method: "POST", body: { tripId: t.id, contactName: "A", contactPhone: "123", passengers: [] } });
  assert.equal(bad.status, 422);
  const ok = await call("/bookings", { method: "POST", body: { tripId: t.id, contactName: "Test Passenger", contactPhone: phone, passengers: [{ name: "Test Passenger", seatNumber: free[0] }, { name: "Second Person", seatNumber: free[1] }] } });
  assert.equal(ok.status, 200, JSON.stringify(ok.json)); assert.match(ok.json.data.reference, /^EX[2-9A-Z]{6}$/);
  // same seat again → conflict
  const clash = await call("/bookings", { method: "POST", body: { tripId: t.id, contactName: "Other", contactPhone: phoneN(), passengers: [{ name: "Other", seatNumber: free[0] }] } });
  assert.equal(clash.status, 409); assert.equal(clash.json.error.code, "SEAT_TAKEN");
  // duplicate phone warning
  const dup = await call("/bookings", { method: "POST", body: { tripId: t.id, contactName: "Test Passenger", contactPhone: phone, passengers: [{ name: "X Y" }] } });
  assert.equal(dup.json.error.code, "DUPLICATE");
  // lookup
  const lk = await call(`/bookings/lookup?ref=${ok.json.data.reference}&phone=${phone}`);
  assert.equal(lk.status, 200);
  assert.equal((await call(`/bookings/lookup?ref=${ok.json.data.reference}&phone=9999999999`)).status, 404);
  const page = await fetch(`${BASE}${lk.json.data.ticketUrl}`); assert.equal(page.status, 200);
  const forged = await fetch(`${BASE}/ticket/${ok.json.data.reference}?k=deadbeef0000`); assert.equal(forged.status, 404);
});

test("capacity is never exceeded under concurrent bookings", async () => {
  const staff = await login("staff@excelcabs.com", "Staff@123");
  const routes = await call("/routes", { token: staff }); const buses = await call("/buses", { token: staff });
  const mini = buses.json.data.find((b: any) => !b.seatLayout); // count-only bus
  const created = await call("/trips", { method: "POST", token: await login("admin@excelcabs.com", "Admin@123"), body: {
    routeId: routes.json.data[0].id, busId: mini.id, travelDate: addDays(todayLocal(), 20), departureTime: "05:15", arrivalTime: "08:00", fare: "99.50", capacityOverride: 5 } });
  assert.equal(created.status, 200, JSON.stringify(created.json));
  const tripId = created.json.data[0].id;
  // 20 parallel single-seat requests for 5 seats
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    call("/bookings", { method: "POST", body: { tripId, contactName: `Racer ${i}`, contactPhone: phoneN(), passengers: [{ name: `Racer ${i}` }] } })));
  const ok = results.filter((r) => r.status === 200).length;
  const full = results.filter((r) => r.status === 409).length;
  assert.equal(ok, 5, `exactly 5 should succeed, got ${ok}`); assert.equal(full, 15);
  const m = await call(`/trips/${tripId}/passengers`, { token: staff });
  assert.equal(m.json.data.totals.passengers, 5); assert.equal(m.json.data.totals.available, 0);
});

test("staff booking, partial payments, balance, cancellation & refund, CSV", async () => {
  const staff = await login("staff@excelcabs.com", "Staff@123");
  const trips = await call(`/trips?from=${addDays(todayLocal(), 4)}&to=${addDays(todayLocal(), 4)}`, { token: staff });
  const t = trips.json.data[0];
  const b = await call("/bookings", { method: "POST", token: staff, body: {
    tripId: t.id, contactName: "WhatsApp Customer", contactPhone: phoneN(), source: "WHATSAPP", farePerPassenger: "100.00",
    passengers: [{ name: "WhatsApp Customer" }, { name: "Guest" }, { name: "Guest Two" }], initialPayment: { amount: "120.50", method: "UPI", txnReference: "UPI123" } } });
  assert.equal(b.status, 200, JSON.stringify(b.json));
  const id = b.json.data.id;
  let d = (await call(`/bookings/${id}`, { token: staff })).json.data;
  assert.equal(d.totalPaise, 30000); assert.equal(d.balance, 17950); assert.equal(d.paymentStatus, "PARTIAL"); assert.equal(d.source, "WHATSAPP");
  assert.equal((await call(`/bookings/${id}/payments`, { method: "POST", token: staff, body: { amount: "500", method: "CASH" } })).status, 400, "cannot overpay");
  const p2 = await call(`/bookings/${id}/payments`, { method: "POST", token: staff, body: { amount: "179.50", method: "CASH" } });
  assert.equal(p2.json.status, "PAID"); assert.equal(p2.json.balance, 0);
  // void keeps history
  const v = await call(`/payments/${p2.json.payment.id}/void`, { method: "POST", token: staff, body: { reason: "Entered twice" } });
  assert.equal(v.json.status, "PARTIAL");
  d = (await call(`/bookings/${id}`, { token: staff })).json.data;
  assert.equal(d.payments.length, 2); assert.ok(d.payments.some((p: any) => p.voidedAt));
  // cancel with refund
  const c = await call(`/bookings/${id}/cancel`, { method: "POST", token: staff, body: { reason: "Customer changed plans", refundAmount: "120.50", refundStatus: "REFUNDED", refundMethod: "UPI" } });
  assert.equal(c.status, 200, JSON.stringify(c.json));
  d = (await call(`/bookings/${id}`, { token: staff })).json.data;
  assert.equal(d.status, "CANCELLED"); assert.equal(d.paymentStatus, "REFUNDED"); assert.ok(d.history.length >= 4);
  // CSV export
  const csv = await fetch(`${BASE}/api/v1/trips/${t.id}/passengers?format=csv`, { headers: { Authorization: `Bearer ${staff}` } });
  assert.equal(csv.status, 200); assert.match(csv.headers.get("content-type") || "", /text\/csv/);
  const sum = await call(`/reports/summary`, { token: staff }); assert.equal(sum.status, 200); assert.equal(sum.json.data.trend.length, 7);
});
