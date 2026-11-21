import { handle, csvResponse } from "@/lib/api";
import { requireRole, BOOKING_STAFF } from "@/lib/auth";
import { todayLocal, fmtTime } from "@/lib/time";
import { fromPaise } from "@/lib/money";
import { tripReport } from "@/server/reports";

// GET /reports/trips?from=&to=[&format=csv]
export const GET = handle(async (req) => {
  await requireRole(...BOOKING_STAFF);
  const s = new URL(req.url).searchParams;
  const from = s.get("from") || todayLocal(); const to = s.get("to") || from;
  const rows = await tripReport(from, to);
  if (s.get("format") === "csv") {
    return csvResponse(`trip-report-${from}-to-${to}.csv`, [
      ["Date", "Departure", "Route", "Bus", "Status", "Capacity", "Passengers", "Bookings", "Fare Total", "Collected", "Outstanding"],
      ...rows.map((r) => [r.travelDate, fmtTime(r.departAt), r.route, r.bus, r.status, r.capacity, r.booked, r.bookings, fromPaise(r.fare), fromPaise(r.collected), fromPaise(r.outstanding)]),
    ]);
  }
  return { data: rows };
});
