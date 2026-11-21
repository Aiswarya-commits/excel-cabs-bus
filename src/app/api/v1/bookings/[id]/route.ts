import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, jsonBody } from "@/lib/api";
import { requireRole, ALL_STAFF, BOOKING_STAFF } from "@/lib/auth";
import { updateBookingSchema } from "@/lib/validation";
import { ticketKey } from "@/lib/jwt";
import { getBooking, updateBooking } from "@/server/bookings";

type P = { id: string };
export const GET = handle<P>(async (_r, { params }) => {
  await requireRole(...ALL_STAFF);
  const b = await getBooking({ id: (await params).id });
  const history = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.entity, "booking"), eq(schema.auditLogs.entityId, b.id))).orderBy(desc(schema.auditLogs.createdAt));
  return { data: { ...b, ticketUrl: `/ticket/${b.reference}?k=${await ticketKey(b.reference)}`, history } };
});
export const PATCH = handle<P>(async (req, { params }) => {
  const actor = await requireRole(...BOOKING_STAFF);
  return updateBooking((await params).id, updateBookingSchema.parse(await jsonBody(req)), actor);
});
