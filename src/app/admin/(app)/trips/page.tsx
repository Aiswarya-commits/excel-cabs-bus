"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { formatINR, fromPaise } from "@/lib/money";
import { fmtDate, fmtTime, fmtTime24, todayLocal, addDays } from "@/lib/time";
import { Alert, Empty, Modal, OccupancyBar, Spinner, StatusBadge } from "@/components/ui";
import { useActor } from "../AdminShell";

type Trip = { id: string; travelDate: string; departAt: string; arriveAt: string; fare: number; status: string; notes: string | null; capacity: number; capacityOverride: number | null; booked: number; route: { id: string; name: string }; bus: { id: string; name: string; registration: string } };
type Opt = { id: string; name: string; active: boolean; capacity?: number };

function TripsInner() {
  const sp = useSearchParams(); const actor = useActor(); const canEdit = actor.role !== "TRIP_STAFF";
  const [from, setFrom] = useState(sp.get("from") ?? todayLocal()); const [to, setTo] = useState(sp.get("to") ?? addDays(todayLocal(), 2));
  const [routeId, setRouteId] = useState("");
  const { data, loading, error, reload } = useApi<{ data: Trip[] }>(`/trips?from=${from}&to=${to}${routeId ? `&routeId=${routeId}` : ""}`);
  const { data: routes } = useApi<{ data: Opt[] }>("/routes");
  const { data: buses } = useApi<{ data: Opt[] }>(canEdit ? "/buses" : null);
  const [edit, setEdit] = useState<Trip | "new" | null>(null);
  const [msg, setMsg] = useState("");

  const byDate = (data?.data ?? []).reduce<Record<string, Trip[]>>((a, t) => { (a[t.travelDate] ??= []).push(t); return a; }, {});
  async function quickStatus(t: Trip, status: string) {
    if (status === "CANCELLED" && t.booked > 0 && !confirm(`${t.booked} passengers are booked. Mark the trip cancelled? (Bookings must still be cancelled/refunded individually.)`)) return;
    await api(`/trips/${t.id}`, { method: "PATCH", json: { status } }); setMsg(`Trip marked ${status.toLowerCase()}`); reload();
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Trips & manifests</h1>
        {canEdit && <button className="btn-primary" onClick={() => setEdit("new")}>+ Schedule trips</button>}
      </div>
      <div className="card flex flex-wrap gap-2 p-3">
        <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        <select className="input w-auto" value={routeId} onChange={(e) => setRouteId(e.target.value)} aria-label="Route"><option value="">All routes</option>{routes?.data.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      </div>
      {msg && <Alert tone="success">{msg}</Alert>}{error && <Alert>{error}</Alert>}
      {loading && !data && <div className="flex justify-center p-10"><Spinner className="h-6 w-6 text-brand-600" /></div>}
      {data && !data.data.length && <Empty>No trips in this range.</Empty>}
      {Object.entries(byDate).map(([d, list]) => (
        <div key={d} className="card overflow-hidden">
          <div className="border-b bg-slate-50 px-4 py-2 text-sm font-bold">{fmtDate(d)} <span className="font-normal text-slate-500">· {list.length} trips · {list.reduce((s, t) => s + t.booked, 0)} passengers</span></div>
          <div className="overflow-x-auto"><table className="table-x">
            <thead><tr><th>Time</th><th>Route</th><th>Bus</th><th>Fare</th><th>Occupancy</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>{list.map((t) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap font-bold tabular-nums">{fmtTime(t.departAt)}<div className="text-[11px] font-normal text-slate-400">→ {fmtTime(t.arriveAt)}</div></td>
                <td>{t.route.name}{t.notes && <div className="text-[11px] text-slate-500">{t.notes}</div>}</td>
                <td className="text-slate-600">{t.bus.name}<div className="text-[11px] text-slate-400">{t.bus.registration}</div></td>
                <td>{formatINR(t.fare)}</td><td><OccupancyBar booked={t.booked} capacity={t.capacity} /></td><td><StatusBadge s={t.status} /></td>
                <td className="whitespace-nowrap text-right">
                  <Link className="btn-primary btn-sm" href={`/admin/trips/${t.id}`}>Manifest</Link>{" "}
                  {canEdit && <>
                    <button className="btn-outline btn-sm" onClick={() => setEdit(t)}>Edit</button>{" "}
                    <select className="input inline-block w-auto py-1 text-xs" value="" onChange={(e) => e.target.value && quickStatus(t, e.target.value)} aria-label="Change status">
                      <option value="">Status…</option>{["OPEN", "SCHEDULED", "COMPLETED", "CANCELLED"].filter((s) => s !== t.status).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </>}
                </td>
              </tr>))}</tbody>
          </table></div>
        </div>
      ))}
      {edit && <TripForm trip={edit === "new" ? null : edit} routes={routes?.data ?? []} buses={buses?.data ?? []} onClose={() => setEdit(null)} onSaved={(m) => { setEdit(null); setMsg(m); reload(); }} />}
    </div>
  );
}

function TripForm({ trip, routes, buses, onClose, onSaved }: { trip: Trip | null; routes: Opt[]; buses: Opt[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [f, setF] = useState({
    routeId: trip?.route.id ?? routes.find((r) => r.active)?.id ?? "", busId: trip?.bus.id ?? buses.find((b) => b.active)?.id ?? "",
    travelDate: trip?.travelDate ?? todayLocal(), departureTime: trip ? fmtTime24(trip.departAt) : "07:00", arrivalTime: trip ? fmtTime24(trip.arriveAt) : "10:00",
    fare: trip ? fromPaise(trip.fare) : "", status: trip?.status ?? "OPEN", capacityOverride: trip?.capacityOverride ? String(trip.capacityOverride) : "", notes: trip?.notes ?? "", repeatDays: "1",
  });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const body = { ...f, capacityOverride: f.capacityOverride ? Number(f.capacityOverride) : null, notes: f.notes || null, repeatDays: Number(f.repeatDays) };
    try {
      if (trip) { const { repeatDays: _r, ...rest } = body; void _r; await api(`/trips/${trip.id}`, { method: "PATCH", json: rest }); onSaved("Trip updated"); }
      else { const r = await api<{ count: number }>("/trips", { method: "POST", json: body }); onSaved(`${r.count} trip(s) scheduled`); }
    } catch (ex) { setErr((ex as Error).message); setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={trip ? "Edit trip" : "Schedule trips"} wide>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Route</label><select className="input" value={f.routeId} onChange={set("routeId")}>{routes.filter((r) => r.active || r.id === f.routeId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div><label className="label">Bus</label><select className="input" value={f.busId} onChange={set("busId")}>{buses.filter((b) => b.active || b.id === f.busId).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.capacity} seats)</option>)}</select></div>
        <div><label className="label">{trip ? "Travel date" : "First travel date"}</label><input type="date" className="input" value={f.travelDate} onChange={set("travelDate")} required /></div>
        {!trip && <div><label className="label">Repeat daily for (days)</label><input type="number" min={1} max={90} className="input" value={f.repeatDays} onChange={set("repeatDays")} /></div>}
        <div><label className="label">Departure</label><input type="time" className="input" value={f.departureTime} onChange={set("departureTime")} required /></div>
        <div><label className="label">Arrival</label><input type="time" className="input" value={f.arrivalTime} onChange={set("arrivalTime")} required /></div>
        <div><label className="label">Fare per seat (₹)</label><input className="input" inputMode="decimal" value={f.fare} onChange={set("fare")} required /></div>
        <div><label className="label">Capacity override</label><input type="number" className="input" placeholder="Use bus capacity" value={f.capacityOverride} onChange={set("capacityOverride")} /></div>
        <div><label className="label">Status</label><select className="input" value={f.status} onChange={set("status")}>{["OPEN", "SCHEDULED", "COMPLETED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label className="label">Notes (shown to passengers)</label><input className="input" value={f.notes} onChange={set("notes")} /></div>
        {err && <div className="sm:col-span-2"><Alert>{err}</Alert></div>}
        <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? <Spinner /> : trip ? "Save trip" : `Create ${f.repeatDays} trip(s)`}</button>
      </form>
    </Modal>
  );
}
export default function TripsPage() { return <Suspense><TripsInner /></Suspense>; }
