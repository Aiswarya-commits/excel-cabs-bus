import { z } from "zod";
import { handle, clientIp } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { phone } from "@/lib/validation";
import { notFound } from "@/lib/errors";
import { ticketKey } from "@/lib/jwt";
import { getBooking } from "@/server/bookings";

// Public: passenger finds their ticket with booking ref + phone
const q = z.object({ ref: z.string().trim().toUpperCase().min(4).max(12), phone });
export const GET = handle(async (req) => {
  rateLimit(`lookup:${clientIp(req)}`, 15, 60_000);
  const { ref, phone: ph } = q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const b = await getBooking({ reference: ref }).catch(() => null);
  if (!b || b.contactPhone !== ph) throw notFound("No booking found with that reference and phone number");
  return { data: { reference: b.reference, ticketUrl: `/ticket/${b.reference}?k=${await ticketKey(b.reference)}` } };
});
