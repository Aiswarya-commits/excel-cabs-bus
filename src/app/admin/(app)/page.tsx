"use client";
import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { formatINR } from "@/lib/money";
import { fmtTime, todayLocal, fmtDate } from "@/lib/time";
import { Alert, Empty, OccupancyBar, Spinner, Stat, StatusBadge, label } from "@/components/ui";

type Summary = { data: {
  trips: number; activeBookings: number; cancelled: number; pending: number; passengers: number; fare: number; collected: number; outstanding: number;
  receivedNet: number; receivedByMethod: Record<string, number>; byPaymentStatus: Record<string, number>; bySource: Record<string, number>;
  tripList: { id: string; route: string; departAt: string; bus: string; status: string; capacity: number; booked: number }[];
  trend: { date: string; bookings: number; received: number }[];
} };

export default function Dashboard() {
  const [date, setDate] = useState(todayLocal());
  const { data, loading, error } = useApi<Summary>(`/reports/summary?from=${date}&to=${date}`);
  const s = data?.data;
  const maxB = Math.max(1, ...(s?.trend.map((t) => t.bookings) ?? [1]));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold">Dashboard</h1><p className="text-sm text-slate-500">Operations for {fmtDate(date)}</p></div>
        <div className="flex items-center gap-2">
          <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Travel date" />
          <Link href="/admin/bookings/new" className="btn-primary">+ New booking</Link>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      {loading && !s && <div className="flex justify-center py-20"><Spinner className="h-8 w-8 text-brand-600" /></div>}
      {s && <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat title="Trips" value={s.trips} sub="scheduled for the day" />
          <Stat title="Passengers" value={s.passengers} sub={`${s.activeBookings} bookings`} />
          <Stat title="Pending" value={s.pending} tone={s.pending ? "warn" : "default"} sub="need confirmation" />
          <Stat title="Fare value" value={formatINR(s.fare)} sub={`${s.cancelled} cancelled`} />
          <Stat title="Collected" value={formatINR(s.collected)} tone="good" sub="for these trips" />
          <Stat title="Outstanding" value={formatINR(s.outstanding)} tone={s.outstanding ? "bad" : "good"} sub="balance to collect" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-bold">Trips</h2><Link href={`/admin/trips?from=${date}&to=${date}`} className="text-sm font-semibold text-brand-700">Manage →</Link></div>
            {s.tripList.length === 0 ? <div className="p-4"><Empty>No trips on this date.</Empty></div> : (
              <div className="overflow-x-auto"><table className="table-x">
                <thead><tr><th>Departs</th><th>Route</th><th>Bus</th><th>Occupancy</th><th>Status</th><th /></tr></thead>
                <tbody>{s.tripList.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap font-bold tabular-nums">{fmtTime(t.departAt)}</td><td>{t.route}</td><td className="text-slate-500">{t.bus}</td>
                    <td><OccupancyBar booked={t.booked} capacity={t.capacity} /></td><td><StatusBadge s={t.status} /></td>
                    <td className="text-right"><Link className="btn-outline btn-sm" href={`/admin/trips/${t.id}`}>Manifest</Link></td>
                  </tr>))}</tbody>
              </table></div>
            )}
          </div>

          <div className="space-y-5">
            <div className="card p-4">
              <h2 className="font-bold">Received today</h2>
              <div className="mt-1 text-2xl font-extrabold text-emerald-700">{formatINR(s.receivedNet)}</div>
              <div className="mt-2 space-y-1 text-sm">{Object.entries(s.receivedByMethod).map(([m, v]) => <div key={m} className="flex justify-between"><span className="text-slate-500">{m}</span><span className="font-semibold">{formatINR(v)}</span></div>)}</div>
              <p className="mt-2 text-[11px] text-slate-400">All payments recorded on the selected date, any trip.</p>
            </div>
            <div className="card p-4">
              <h2 className="font-bold">Payment status</h2>
              <div className="mt-2 flex flex-wrap gap-2">{Object.entries(s.byPaymentStatus).map(([k, v]) => <Link key={k} href={`/admin/bookings?date=${date}&paymentStatus=${k}`} className="flex items-center gap-1.5"><StatusBadge s={k} /><span className="text-sm font-bold">{v}</span></Link>)}</div>
              <h2 className="mt-4 font-bold">Booking source</h2>
              <div className="mt-2 flex flex-wrap gap-2">{Object.entries(s.bySource).map(([k, v]) => <span key={k} className="flex items-center gap-1.5"><StatusBadge s={k} /><span className="text-sm font-bold">{v}</span></span>)}</div>
            </div>
            <div className="card p-4">
              <h2 className="font-bold">Last 7 days</h2>
              <div className="mt-3 flex h-28 items-end gap-2">
                {s.trend.map((t) => (
                  <div key={t.date} className="flex flex-1 flex-col items-center gap-1" title={`${t.date}: ${t.bookings} bookings, ${formatINR(t.received)} received`}>
                    <span className="text-[10px] font-semibold tabular-nums text-slate-600">{t.bookings}</span>
                    <div className="w-full rounded-t bg-brand-500" style={{ height: `${(t.bookings / maxB) * 80 + 2}px` }} />
                    <span className="text-[10px] text-slate-400">{new Date(t.date + "T12:00:00Z").toLocaleDateString("en-IN", { weekday: "narrow" })}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Bookings created per day · {label("ONLINE")} + staff</p>
            </div>
          </div>
        </div>
      </>}
    </div>
  );
}
