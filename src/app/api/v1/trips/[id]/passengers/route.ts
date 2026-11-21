import { handle, csvResponse } from "@/lib/api";
import { requireRole, ALL_STAFF } from "@/lib/auth";
import { tripManifest } from "@/server/bookings";
import { fromPaise } from "@/lib/money";
import { fmtTime } from "@/lib/time";

type P = { id: string };
// GET /trips/:id/passengers[?format=csv]
export const GET = handle<P>(async (req, { params }) => {
  await requireRole(...ALL_STAFF);
  const { id } = await params;
  const m = await tripManifest(id);
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const rows: (string | number | null)[][] = [["Booking Ref", "Seat", "Passenger", "Age", "Contact", "Phone", "Boarding", "Drop", "Source", "Booking Status", "Payment Status", "Total", "Paid", "Balance", "Boarded"]];
    for (const b of m.bookings.filter((x) => x.status !== "CANCELLED")) for (const p of b.passengers)
      rows.push([b.reference, p.seatNumber, p.passenger.name, p.passenger.age, b.contactName, b.contactPhone, b.boardingStop?.name ?? "", b.dropStop?.name ?? "", b.source, b.status, b.paymentStatus, b.totalFare, fromPaise(b.money.net), fromPaise(b.money.balance), p.boarding]);
    const name = `manifest-${m.trip.route.name.replace(/[^a-z0-9]+/gi, "-")}-${m.trip.travelDate}-${fmtTime(m.trip.departAt).replace(/[^0-9apm]/gi, "")}.csv`;
    return csvResponse(name, rows);
  }
  return { data: m };
});
