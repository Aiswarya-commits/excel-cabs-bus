"use client";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { formatINR } from "@/lib/money";
import { fmtDate, fmtTime, todayLocal, addDays, fmtDateTime } from "@/lib/time";
import { Spinner, Stat, StatusBadge, OccupancyBar } from "@/components/ui";

type TR = { id: string; travelDate: string; departAt: string; route: string; bus: string; status: string; capacity: number; booked: number; bookings: number; fare: number; collected: number; outstanding: number };
type Pay = { id: string; kind: string; amount: string; method: string; txnReference: string | null; receivedAt: string; reference: string; contactName: string; staff: string | null; voidedAt: string | null };
type Sum = { data: { trips: number; passengers: number; activeBookings: number; cancelled: number; fare: number; collected: number; outstanding: number; receivedNet: number; receivedByMethod: Record<string, number>; bySource: Record<string, number> } };

export default function Reports() {
  const [from, setFrom] = useState(addDays(todayLocal(), -6)); const [to, setTo] = useState(todayLocal());
  const [tab, setTab] = useState<"trips" | "collections">("trips");
  const qs = `from=${from}&to=${to}`;
  const { data: sum } = useApi<Sum>(`/reports/summary?${qs}`);
  const { data: trips, loading } = useApi<{ data: TR[] }>(`/reports/trips?${qs}`);
  const { data: pays } = useApi<{ data: Pay[] }>(tab === "collections" ? `/reports/collections?${qs}` : null);
  const s = sum?.data;
  const preset = (d: number) => { setFrom(addDays(todayLocal(), -d)); setTo(todayLocal()); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost btn-sm" onClick={() => preset(0)}>Today</button><button className="btn-ghost btn-sm" onClick={() => preset(6)}>7 days</button><button className="btn-ghost btn-sm" onClick={() => preset(29)}>30 days</button>
          <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        </div>
      </div>
      {s && <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat title="Trips" value={s.trips} /><Stat title="Passengers" value={s.passengers} /><Stat title="Bookings" value={s.activeBookings} sub={`${s.cancelled} cancelled`} />
        <Stat title="Fare value" value={formatINR(s.fare)} /><Stat title="Collected" value={formatINR(s.collected)} tone="good" sub="for trips in range" />
        <Stat title="Outstanding" value={formatINR(s.outstanding)} tone={s.outstanding ? "bad" : "good"} />
        <Stat title="Cash-in (by date)" value={formatINR(s.receivedNet)} sub={Object.entries(s.receivedByMethod).map(([k, v]) => `${k} ${formatINR(v)}`).join(" · ")} />
      </div>}
      <div className="flex flex-wrap items-center gap-2">
        <button className={tab === "trips" ? "btn-primary btn-sm" : "btn-outline btn-sm"} onClick={() => setTab("trips")}>Trip-wise</button>
        <button className={tab === "collections" ? "btn-primary btn-sm" : "btn-outline btn-sm"} onClick={() => setTab("collections")}>Payment collections</button>
        <a className="btn-outline btn-sm ml-auto" href={`/api/v1/reports/${tab}?${qs}&format=csv`}>⬇ Export CSV</a>
      </div>
      <div className="card overflow-x-auto">
        {tab === "trips" ? (loading && !trips ? <div className="p-8"><Spinner /></div> : (
          <table className="table-x"><thead><tr><th>Date</th><th>Time</th><th>Route</th><th>Bus</th><th>Status</th><th>Load</th><th className="text-right">Fare</th><th className="text-right">Collected</th><th className="text-right">Outstanding</th></tr></thead>
            <tbody>{trips?.data.map((t) => (<tr key={t.id}><td>{fmtDate(t.travelDate)}</td><td>{fmtTime(t.departAt)}</td><td>{t.route}</td><td className="text-slate-500">{t.bus}</td><td><StatusBadge s={t.status} /></td><td><OccupancyBar booked={t.booked} capacity={t.capacity} /></td>
              <td className="text-right tabular-nums">{formatINR(t.fare)}</td><td className="text-right tabular-nums text-emerald-700">{formatINR(t.collected)}</td><td className={`text-right tabular-nums ${t.outstanding ? "text-red-600" : ""}`}>{formatINR(t.outstanding)}</td></tr>))}</tbody></table>
        )) : (
          <table className="table-x"><thead><tr><th>Received</th><th>Booking</th><th>Customer</th><th>Type</th><th>Method</th><th>Txn ref</th><th>By</th><th className="text-right">Amount</th></tr></thead>
            <tbody>{pays?.data.map((p) => (<tr key={p.id} className={p.voidedAt ? "line-through opacity-50" : ""}><td className="text-xs">{fmtDateTime(p.receivedAt)}</td><td className="font-mono text-xs font-bold">{p.reference}</td><td>{p.contactName}</td><td>{p.kind}</td><td>{p.method}</td><td className="text-xs">{p.txnReference}</td><td className="text-xs">{p.staff}</td>
              <td className={`text-right font-semibold tabular-nums ${p.kind === "REFUND" ? "text-red-600" : "text-emerald-700"}`}>{p.kind === "REFUND" ? "−" : ""}₹{p.amount}</td></tr>))}</tbody></table>
        )}
      </div>
    </div>
  );
}
