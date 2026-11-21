"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Alert, Modal, Spinner } from "@/components/ui";

type Stop = { name: string; landmark: string | null; offsetMinutes: number; isBoarding: boolean; isDropoff: boolean };
type Route = { id: string; name: string; origin: string; destination: string; distanceKm: number | null; active: boolean; stops: (Stop & { id: string; sequence: number })[] };

export default function Routes() {
  const { data, loading, reload } = useApi<{ data: Route[] }>("/routes");
  const [edit, setEdit] = useState<Route | "new" | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold">Routes & stops</h1><button className="btn-primary" onClick={() => setEdit("new")}>+ Add route</button></div>
      {loading && !data ? <Spinner className="h-6 w-6 text-brand-600" /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data?.data.map((r) => (
            <div key={r.id} className={`card p-4 ${r.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between">
                <div><div className="font-bold">{r.name}</div><div className="text-xs text-slate-500">{r.stops.length} stops{r.distanceKm ? ` · ${r.distanceKm} km` : ""}{r.active ? "" : " · inactive"}</div></div>
                <button className="btn-outline btn-sm" onClick={() => setEdit(r)}>Edit</button>
              </div>
              <ol className="mt-3 flex flex-wrap items-center gap-1 text-xs">
                {r.stops.map((s, i) => <li key={s.id} className="flex items-center gap-1"><span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-900">{s.name} <span className="text-slate-400">+{s.offsetMinutes}m</span></span>{i < r.stops.length - 1 && <span className="text-slate-300">→</span>}</li>)}
              </ol>
            </div>
          ))}
        </div>
      )}
      {edit && <RouteForm route={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function RouteForm({ route, onClose, onSaved }: { route: Route | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: route?.name ?? "", origin: route?.origin ?? "", destination: route?.destination ?? "", distanceKm: route?.distanceKm ? String(route.distanceKm) : "", active: route?.active ?? true });
  const [stops, setStops] = useState<Stop[]>(route?.stops.map(({ name, landmark, offsetMinutes, isBoarding, isDropoff }) => ({ name, landmark, offsetMinutes, isBoarding, isDropoff })) ?? [
    { name: "", landmark: "", offsetMinutes: 0, isBoarding: true, isDropoff: false }, { name: "", landmark: "", offsetMinutes: 60, isBoarding: false, isDropoff: true }]);
  const [err, setErr] = useState("");
  const upd = (i: number, p: Partial<Stop>) => setStops((s) => s.map((x, k) => k === i ? { ...x, ...p } : x));
  const move = (i: number, d: number) => setStops((s) => { const c = [...s]; const j = i + d; if (j < 0 || j >= c.length) return c; [c[i], c[j]] = [c[j], c[i]]; return c; });
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const s = stops.map((x, i) => ({ ...x, name: i === 0 && !x.name ? f.origin : i === stops.length - 1 && !x.name ? f.destination : x.name }));
    const body = { ...f, name: f.name || `${f.origin} → ${f.destination}`, distanceKm: f.distanceKm ? Number(f.distanceKm) : null, stops: s };
    try { await api(route ? `/routes/${route.id}` : "/routes", { method: route ? "PATCH" : "POST", json: body }); onSaved(); } catch (ex) { setErr((ex as Error).message); }
  }
  return (
    <Modal open onClose={onClose} title={route ? "Edit route" : "Add route"} wide>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <div><label className="label">Origin</label><input className="input" value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })} required /></div>
          <div><label className="label">Destination</label><input className="input" value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} required /></div>
          <div><label className="label">Display name</label><input className="input" placeholder={`${f.origin || "A"} → ${f.destination || "B"}`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="label">Distance km</label><input type="number" className="input" value={f.distanceKm} onChange={(e) => setF({ ...f, distanceKm: e.target.value })} /></div>
        </div>
        <div className="label">Stops in travel order (minutes after departure)</div>
        <div className="space-y-1.5">{stops.map((s, i) => (
          <div key={i} className="grid grid-cols-[24px_1fr_1fr_80px_auto] items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs">
            <span className="font-bold text-brand-700">{i + 1}</span>
            <input className="input py-1.5" placeholder="Stop name" value={s.name} onChange={(e) => upd(i, { name: e.target.value })} />
            <input className="input py-1.5" placeholder="Landmark" value={s.landmark ?? ""} onChange={(e) => upd(i, { landmark: e.target.value })} />
            <input type="number" className="input py-1.5" value={s.offsetMinutes} onChange={(e) => upd(i, { offsetMinutes: Number(e.target.value) })} aria-label="Minutes" />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1"><input type="checkbox" className="accent-brand-600" checked={s.isBoarding} onChange={(e) => upd(i, { isBoarding: e.target.checked })} />Board</label>
              <label className="flex items-center gap-1"><input type="checkbox" className="accent-brand-600" checked={s.isDropoff} onChange={(e) => upd(i, { isDropoff: e.target.checked })} />Drop</label>
              <button type="button" className="btn-ghost btn-sm px-1" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
              <button type="button" className="btn-ghost btn-sm px-1" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
              <button type="button" className="btn-ghost btn-sm px-1 text-red-600" disabled={stops.length <= 2} onClick={() => setStops((x) => x.filter((_, k) => k !== i))} aria-label="Remove">✕</button>
            </div>
          </div>))}</div>
        <button type="button" className="btn-outline btn-sm" onClick={() => setStops((s) => [...s.slice(0, -1), { name: "", landmark: "", offsetMinutes: (s[s.length - 2]?.offsetMinutes ?? 0) + 15, isBoarding: true, isDropoff: true }, s[s.length - 1]])}>+ Add intermediate stop</button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Route active (visible in search)</label>
        {err && <Alert>{err}</Alert>}
        <button className="btn-primary w-full">Save route</button>
      </form>
    </Modal>
  );
}
