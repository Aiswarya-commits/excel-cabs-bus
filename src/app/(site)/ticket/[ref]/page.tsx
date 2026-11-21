import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getBooking } from "@/server/bookings";
import { ticketKey } from "@/lib/jwt";
import { brand } from "@/lib/brand";
import { formatINR, fromPaise } from "@/lib/money";
import { fmtDate, fmtTime } from "@/lib/time";
import { confirmationText } from "@/lib/ticket";
import { Logo } from "@/components/Logo";
import { StatusBadge } from "@/components/ui";
import { TicketActions } from "@/components/TicketActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your ticket", robots: { index: false } };

export default async function TicketPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ k?: string; new?: string }> }) {
  const { ref } = await params; const sp = await searchParams;
  const reference = ref.toUpperCase();
  if (!sp.k || sp.k !== (await ticketKey(reference))) notFound();
  const b = await getBooking({ reference }).catch(() => null);
  if (!b) notFound();
  const url = `/ticket/${b.reference}?k=${sp.k}`;
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const qr = await QRCode.toDataURL(`${base}${url}`, { margin: 1, width: 220, color: { dark: "#620808" } });
  const upi = b.balance > 0 && b.status !== "CANCELLED"
    ? `upi://pay?pa=${encodeURIComponent(brand.upiId)}&pn=${encodeURIComponent(brand.name)}&am=${fromPaise(b.balance)}&cu=INR&tn=${encodeURIComponent(`Bus ${b.reference}`)}` : null;
  const maskedPhone = b.contactPhone.replace(/^(\d{2})\d{5}(\d{3})$/, "$1•••••$2");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {sp.new && (
        <div className="no-print mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <div className="text-lg font-bold">🎉 {b.status === "CONFIRMED" ? "Booking confirmed!" : "Booking received!"}</div>
          <p className="text-sm">Save this page or share it on WhatsApp. {b.status === "PENDING" ? "Our team will confirm your booking shortly." : ""}</p>
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between bg-brand-600 px-5 py-4 text-white">
          <div className="rounded-md bg-white px-2 py-1"><Logo className="h-7" /></div>
          <div className="text-right"><div className="text-[11px] uppercase tracking-wider text-brand-100">Booking ref</div><div className="font-mono text-xl font-extrabold tracking-wider">{b.reference}</div></div>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto]">
          <div>
            <div className="flex flex-wrap gap-2"><StatusBadge s={b.status} /><StatusBadge s={b.paymentStatus} /></div>
            <h1 className="mt-3 text-xl font-extrabold">{b.trip.route.name}</h1>
            <div className="text-sm text-slate-500">{fmtDate(b.trip.travelDate)}</div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div><div className="label">Boarding</div><div className="text-lg font-bold">{fmtTime(b.boardingTime)}</div><div>{b.boardingStop?.name}</div><div className="text-xs text-slate-500">{b.boardingStop?.landmark}</div></div>
              <div><div className="label">Drop-off</div><div className="text-lg font-bold">{b.dropStop?.name}</div><div className="text-xs text-slate-500">{b.dropStop?.landmark}</div></div>
              <div><div className="label">Bus</div><div className="font-semibold">{b.trip.bus.name}</div><div className="text-xs text-slate-500">{b.trip.bus.type} · {b.trip.bus.registration}</div></div>
              <div><div className="label">Contact</div><div className="font-semibold">{b.contactName}</div><div className="text-xs text-slate-500">+91 {maskedPhone}</div></div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Ticket QR code" width={150} height={150} className="rounded-lg border" />
            <div className="mt-1 text-[10px] text-slate-400">Show at boarding</div>
          </div>
        </div>
        <div className="border-t px-5 py-4">
          <table className="table-x">
            <thead><tr><th>#</th><th>Passenger</th><th>Age</th><th>Seat</th></tr></thead>
            <tbody>{b.passengers.map((p, i) => <tr key={p.id}><td>{i + 1}</td><td className="font-medium">{p.passenger.name}</td><td>{p.passenger.age ?? "—"}</td><td className="font-bold text-brand-700">{p.seatNumber ?? "On boarding"}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="grid gap-4 border-t bg-slate-50 px-5 py-4 sm:grid-cols-2">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Total fare</dt><dd className="font-semibold">{formatINR(b.totalPaise)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Paid</dt><dd>{formatINR(b.net)}</dd></div>
            <div className="flex justify-between text-base font-extrabold"><dt>Balance due</dt><dd className={b.balance ? "text-red-600" : "text-emerald-700"}>{formatINR(b.balance)}</dd></div>
          </dl>
          {b.status === "CANCELLED" ? (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">This booking was cancelled{b.cancellation ? `: ${b.cancellation.reason}` : "."}</div>
          ) : upi ? (
            <div className="rounded-lg bg-white p-3 text-sm">
              <div className="font-semibold">Pay by UPI</div>
              <div className="text-xs text-slate-500">UPI ID: <span className="font-mono">{brand.upiId}</span> · mention ref {b.reference}</div>
              <a href={upi} className="btn-accent btn-sm no-print mt-2">Pay {formatINR(b.balance)} with UPI app</a>
              <div className="mt-1 text-[11px] text-slate-400">Or pay cash at boarding. Staff will update your payment.</div>
            </div>
          ) : <div className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">✓ Fully paid. Have a great journey!</div>}
        </div>
        <div className="border-t px-5 py-3 text-xs text-slate-500">Please reach your boarding point 10 minutes early. Help: {brand.phone} · WhatsApp {brand.whatsapp.replace(/^91/, "+91 ")}</div>
      </div>
      <div className="mt-4"><TicketActions shareText={confirmationText(b)} url={url} /></div>
    </div>
  );
}
