import { handle, jsonBody } from "@/lib/api";
import { requireRole, BOOKING_STAFF } from "@/lib/auth";
import { voidPaymentSchema } from "@/lib/validation";
import { voidPayment } from "@/server/bookings";

type P = { id: string };
export const POST = handle<P>(async (req, { params }) => {
  const actor = await requireRole(...BOOKING_STAFF);
  const { reason } = voidPaymentSchema.parse(await jsonBody(req));
  return voidPayment((await params).id, reason, actor);
});
