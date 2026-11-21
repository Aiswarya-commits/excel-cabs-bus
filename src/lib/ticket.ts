import { brand } from "./brand";
import { formatINR } from "./money";
import { fmtDate, fmtTime } from "./time";

/** Plain-text confirmation message for WhatsApp/SMS sharing (SDD §4.2). */
export function confirmationText(b: {
  reference: string; status: string; contactName: string; totalPaise: number; balance: number;
  trip: { travelDate: string; route: { name: string }; bus: { name: string; registration: string } };
  boardingStop: { name: string } | null; dropStop: { name: string } | null; boardingTime: Date;
  passengers: { seatNumber: string | null; passenger: { name: string } }[];
}) {
  const seats = b.passengers.map((p) => p.seatNumber).filter(Boolean).join(", ");
  return [
    `🚌 *${brand.name} — Booking ${b.status === "CONFIRMED" ? "Confirmed" : b.status === "PENDING" ? "Received" : b.status}*`,
    `Ref: *${b.reference}*`,
    `${b.trip.route.name}`,
    `📅 ${fmtDate(b.trip.travelDate)} · ⏰ ${fmtTime(b.boardingTime)}`,
    `📍 Board: ${b.boardingStop?.name ?? "-"} → Drop: ${b.dropStop?.name ?? "-"}`,
    `👥 ${b.passengers.length} passenger(s)${seats ? ` · Seats ${seats}` : ""}`,
    `🚍 ${b.trip.bus.name} (${b.trip.bus.registration})`,
    `💰 Total ${formatINR(b.totalPaise)}${b.balance > 0 ? ` · Balance due ${formatINR(b.balance)}` : " · Paid"}`,
    `Help: ${brand.phone}`,
  ].join("\n");
}
