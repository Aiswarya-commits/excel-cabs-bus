import { and, between, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, csvResponse } from "@/lib/api";
import { requireRole, BOOKING_STAFF } from "@/lib/auth";
import { todayLocal, localToUtc, addDays, fmtDateTime } from "@/lib/time";

const { payments, bookings, users } = schema;
// GET /reports/collections?from=&to=[&format=csv] — every payment/refund received in the period
export const GET = handle(async (req) => {
  await requireRole(...BOOKING_STAFF);
  const s = new URL(req.url).searchParams;
  const from = s.get("from") || todayLocal(); const to = s.get("to") || from;
  const rows = await db.select({ p: payments, reference: bookings.reference, contactName: bookings.contactName, bookingId: bookings.id, staff: users.name })
    .from(payments).innerJoin(bookings, eq(bookings.id, payments.bookingId)).leftJoin(users, eq(users.id, payments.recordedById))
    .where(and(between(payments.receivedAt, localToUtc(from, "00:00"), localToUtc(addDays(to, 1), "00:00"))))
    .orderBy(desc(payments.receivedAt)).limit(5000);
  if (s.get("format") === "csv") {
    return csvResponse(`collections-${from}-to-${to}.csv`, [
      ["Received", "Booking Ref", "Customer", "Type", "Method", "Amount", "Txn Ref", "Recorded By", "Voided", "Void Reason"],
      ...rows.map((r) => [fmtDateTime(r.p.receivedAt), r.reference, r.contactName, r.p.kind, r.p.method, r.p.kind === "REFUND" ? `-${r.p.amount}` : r.p.amount, r.p.txnReference, r.staff, r.p.voidedAt ? "YES" : "", r.p.voidReason]),
    ]);
  }
  return { data: rows.map((r) => ({ ...r.p, reference: r.reference, contactName: r.contactName, bookingId: r.bookingId, staff: r.staff })) };
});
