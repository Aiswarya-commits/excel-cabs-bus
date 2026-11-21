import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, jsonBody } from "@/lib/api";
import { requireRole, ALL_STAFF, BOOKING_STAFF } from "@/lib/auth";
import { paymentSchema } from "@/lib/validation";
import { addPayment } from "@/server/bookings";

type P = { id: string };
export const GET = handle<P>(async (_r, { params }) => {
  await requireRole(...ALL_STAFF);
  const data = await db.query.payments.findMany({ where: eq(schema.payments.bookingId, (await params).id), orderBy: desc(schema.payments.receivedAt), with: { recordedBy: { columns: { name: true } } } });
  return { data };
});
export const POST = handle<P>(async (req, { params }) => {
  const actor = await requireRole(...BOOKING_STAFF);
  return addPayment((await params).id, paymentSchema.parse(await jsonBody(req)), actor);
});
