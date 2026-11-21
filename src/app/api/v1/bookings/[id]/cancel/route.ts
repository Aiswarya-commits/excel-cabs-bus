import { handle, jsonBody } from "@/lib/api";
import { requireRole, BOOKING_STAFF } from "@/lib/auth";
import { cancelSchema } from "@/lib/validation";
import { cancelBooking } from "@/server/bookings";

type P = { id: string };
export const POST = handle<P>(async (req, { params }) => {
  const actor = await requireRole(...BOOKING_STAFF);
  return cancelBooking((await params).id, cancelSchema.parse(await jsonBody(req)), actor);
});
