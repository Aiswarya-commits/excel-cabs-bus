"use client";
import Link from "next/link";
import { use, useState } from "react";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { formatINR, toPaise } from "@/lib/money";
import { fmtDate, fmtTime } from "@/lib/time";
import { Alert, Spinner, Stat, StatusBadge } from "@/components/ui";
import { useActor } from "../../AdminShell";

type BP = { id: string; seatNumber: string | null; boarding: string; passenger: { name: string; age: number | null } };
type Bk = { id: string; reference: string; status: string; paymentStatus: string; source: string; contactName: string; contactPhone: string; totalFare: string; notes: string | null; boardingStop: { name: string; sequence: number } | null; dropStop: { name: string } | null; passengers: BP[]; money: { net: number; balance: number } };
type M = { data: { trip: { id: string; travelDate: string; departAt: string; status: string; route: { name: string; stops: { id: string; name: string }[] }; bus: { name: string; registration: string } }; capacity: number; bookings: Bk[]; totals: { bookings: number; passengers: number; available: number; boarded: number; fare: number; collected: number; outstanding: number } } };

export default function Manifest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const actor = useActor();
  const { data, loading, error, reload } = useApi<M>(`/trips/${id}/passengers`);
  const [q, setQ] = useState(""); const [stop, setStop] = useState(""); const [showCancelled, setShowCancelled] = useState(false);
  const [err, setErr] = useState("");
  if (loading && !data) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8 text-brand-600" /></div>;
  if (error || !data) return <Alert>{error}</Alert>;
  const m = data.data;
  async function board(bp: BP, status: string) {
    setErr("");
    try { await api(`/booking-passengers/${bp.id}/boarding`, { method: "PATCH", json: { status } }); reload(); } catch (e) { setErr((e as Error).message); }
  }
  const rows = m.bookings.filter((b) => (showCancelled || b.status !== "CANCELLED") && (!stop || b.boardingStop?.name === stop) &&
    (!q || `${b.reference} ${b.contactName} ${b.contactPhone} ${b.passengers.map((p) => p.passenger.name + " " + p.seatNumber).join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  const flat = rows.flatMap((b) => b.passengers.map((p, i) => ({ b, p, first: i === 0, span: b.passengers.length })));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/trips" className="no-print text-xs font-semibold text-brand-700">← Trips</Link>
          <h1 className="mt-1 text-2xl font-extrabold">{m.trip.route.name}</h1>
          <div className="text-sm text-slate-500">{fmtDate(m.trip.travelDate)} · {fmtTime(m.trip.departAt)} · {m.trip.bus.name} ({m.trip.bus.registration}) <StatusBadge s={m.trip.status} /></div>
        </div>
        <div className="no-print flex gap-2">
          {actor.role !== "TRIP_STAFF" && <Link className="btn-primary" href="/admin/bookings/new">+ Add booking</Link>}
          <a className="btn-outline" href={`/api/v1/trips/${id}/passengers?format=csv`}>⬇ CSV</a>
          <button className="btn-outline" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat title="Passengers" value={`${m.totals.passengers}/${m.capacity}`} /><Stat title="Seats free" value={m.totals.available} tone={m.totals.available ? "good" : "bad"} />
        <Stat title="Boarded" value={`${m.totals.boarded}/${m.totals.passengers}`} /><Stat title="Bookings" value={m.totals.bookings} />
        <Stat title="Fare" value={formatINR(m.totals.fare)} /><Stat title="Collected" value={formatINR(m.totals.collected)} tone="good" />
        <Stat title="To collect" value={formatINR(m.totals.outstanding)} tone={m.totals.outstanding ? "bad" : "good"} />
      </div>
      <div className="no-print card flex flex-wrap items-center gap-2 p-3">
        <input className="input max-w-xs" placeholder="Search name, seat, phone, ref…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={stop} onChange={(e) => setStop(e.target.value)} aria-label="Boarding point"><option value="">All boarding points</option>{m.trip.route.stops.map((s) => <option key={s.id}>{s.name}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />Show cancelled</label>
      </div>
      {err && <Alert>{err}</Alert>}
      <div className="card overflow-x-auto">
        <table className="table-x">
          <thead><tr><th>Seat</th><th>Passenger</th><th>Booking</th><th>Contact</th><th>Board → Drop</th><th>Payment</th><th className="text-right">Balance</th><th className="no-print">Boarding</th></tr></thead>
          <tbody>{flat.map(({ b, p, first, span }) => (
            <tr key={p.id} className={b.status === "CANCELLED" ? "opacity-40" : ""}>
              <td className="text-base font-extrabold text-brand-700">{p.seatNumber ?? "—"}</td>
              <td className="font-medium">{p.passenger.name}{p.passenger.age ? <span className="text-xs text-slate-400"> · {p.passenger.age}y</span> : null}</td>
              {first && <>
                <td rowSpan={span}><Link href={`/admin/bookings/${b.id}`} className="font-mono text-xs font-bold text-brand-700">{b.reference}</Link><div className="mt-0.5 flex gap-1"><StatusBadge s={b.status} /></div>{b.notes && <div className="mt-1 max-w-[160px] text-[11px] text-slate-500">📝 {b.notes}</div>}</td>
                <td rowSpan={span}>{b.contactName}<div><a className="text-xs text-brand-700" href={`tel:+91${b.contactPhone}`}>{b.contactPhone}</a></div></td>
                <td rowSpan={span} className="text-xs">{b.boardingStop?.name} → {b.dropStop?.name}</td>
                <td rowSpan={span}><StatusBadge s={b.paymentStatus} /></td>
                <td rowSpan={span} className={`text-right font-semibold tabular-nums ${b.money.balance ? "text-red-600" : "text-emerald-700"}`}>{formatINR(b.money.balance)}<div className="text-[10px] font-normal text-slate-400">of {formatINR(toPaise(b.totalFare))}</div></td>
              </>}
              <td className="no-print">{b.status !== "CANCELLED" && (
                <div className="flex gap-1">
                  <button onClick={() => board(p, p.boarding === "BOARDED" ? "NOT_CHECKED" : "BOARDED")} className={`btn-sm btn ${p.boarding === "BOARDED" ? "bg-emerald-600 text-white" : "btn-outline"}`}>{p.boarding === "BOARDED" ? "✓ Boarded" : "Board"}</button>
                  <button onClick={() => board(p, p.boarding === "NO_SHOW" ? "NOT_CHECKED" : "NO_SHOW")} className={`btn-sm btn ${p.boarding === "NO_SHOW" ? "bg-slate-800 text-white" : "btn-ghost"}`} title="No-show">✕</button>
                </div>)}</td>
            </tr>))}</tbody>
        </table>
        {!flat.length && <p className="p-6 text-center text-sm text-slate-500">No passengers.</p>}
      </div>
    </div>
  );
}
