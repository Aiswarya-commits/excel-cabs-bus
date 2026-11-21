"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Alert, Modal, Spinner } from "@/components/ui";

type Bus = { id: string; name: string; registration: string; capacity: number; type: string; seatLayout: string | null; amenities: string[]; active: boolean };
const TYPES = ["AC Seater", "Non-AC Seater", "AC Sleeper", "Mini Bus (Tempo Traveller)", "Electric Bus"];

export default function Buses() {
  const { data, loading, reload } = useApi<{ data: Bus[] }>("/buses");
  const [edit, setEdit] = useState<Bus | "new" | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold">Buses</h1><button className="btn-primary" onClick={() => setEdit("new")}>+ Add bus</button></div>
      {loading && !data ? <Spinner className="h-6 w-6 text-brand-600" /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data?.data.map((b) => (
            <div key={b.id} className={`card p-4 ${b.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between">
                <div><div className="font-bold">{b.name}</div><div className="font-mono text-xs text-slate-500">{b.registration}</div></div>
                <span className={`badge ${b.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>{b.active ? "Active" : "Inactive"}</span>
              </div>
              <div className="mt-2 text-sm">{b.type} · <b>{b.capacity}</b> seats · {b.seatLayout ? `Layout ${b.seatLayout}` : "No seat numbers"}</div>
              <div className="mt-2 flex flex-wrap gap-1">{b.amenities.map((a) => <span key={a} className="badge bg-slate-100 text-slate-600">{a}</span>)}</div>
              <button className="btn-outline btn-sm mt-3" onClick={() => setEdit(b)}>Edit</button>
            </div>
          ))}
        </div>
      )}
      {edit && <BusForm bus={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function BusForm({ bus, onClose, onSaved }: { bus: Bus | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: bus?.name ?? "", registration: bus?.registration ?? "", capacity: String(bus?.capacity ?? 40), type: bus?.type ?? TYPES[0], seatLayout: bus?.seatLayout ?? "2+2", amenities: bus?.amenities.join(", ") ?? "", active: bus?.active ?? true });
  const [err, setErr] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const body = { ...f, capacity: Number(f.capacity), seatLayout: f.seatLayout || null, amenities: f.amenities.split(",").map((s) => s.trim()).filter(Boolean) };
    try { await api(bus ? `/buses/${bus.id}` : "/buses", { method: bus ? "PATCH" : "POST", json: body }); onSaved(); } catch (ex) { setErr((ex as Error).message); }
  }
  return (
    <Modal open onClose={onClose} title={bus ? "Edit bus" : "Add bus"}>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Display name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
        <div><label className="label">Registration no.</label><input className="input uppercase" value={f.registration} onChange={(e) => setF({ ...f, registration: e.target.value })} required /></div>
        <div><label className="label">Capacity</label><input type="number" min={1} max={80} className="input" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} required /></div>
        <div><label className="label">Type</label><input list="bustypes" className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} /><datalist id="bustypes">{TYPES.map((t) => <option key={t} value={t} />)}</datalist></div>
        <div><label className="label">Seat layout</label><select className="input" value={f.seatLayout} onChange={(e) => setF({ ...f, seatLayout: e.target.value })}><option value="2+2">2+2 (numbered seats)</option><option value="2+1">2+1 (numbered seats)</option><option value="">No seat numbers (count only)</option></select></div>
        <div><label className="label">Status</label><select className="input" value={f.active ? "1" : "0"} onChange={(e) => setF({ ...f, active: e.target.value === "1" })}><option value="1">Active</option><option value="0">Inactive</option></select></div>
        <div className="sm:col-span-2"><label className="label">Amenities (comma separated)</label><input className="input" value={f.amenities} onChange={(e) => setF({ ...f, amenities: e.target.value })} placeholder="AC, Charging point, Water bottle" /></div>
        {err && <div className="sm:col-span-2"><Alert>{err}</Alert></div>}
        <button className="btn-primary sm:col-span-2">Save</button>
      </form>
    </Modal>
  );
}
