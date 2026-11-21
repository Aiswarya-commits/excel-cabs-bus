import { handle } from "@/lib/api";
import { requireRole, BOOKING_STAFF } from "@/lib/auth";
import { normalisePhone } from "@/lib/validation";
import { findDuplicates } from "@/server/bookings";

export const GET = handle(async (req) => {
  await requireRole(...BOOKING_STAFF);
  const s = new URL(req.url).searchParams;
  const tripId = s.get("tripId"); const ph = normalisePhone(s.get("phone") || "");
  if (!tripId || ph.length !== 10) return { data: [] };
  return { data: await findDuplicates(tripId, ph) };
});
