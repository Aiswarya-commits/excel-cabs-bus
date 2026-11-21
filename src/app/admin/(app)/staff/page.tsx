"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { fmtDateTime } from "@/lib/time";
import { Alert, Modal, Spinner, StatusBadge } from "@/components/ui";

type U = { id: string; name: string; email: string; phone: string | null; role: string; active: boolean; lastLoginAt: string | null };
export default function Staff() {
  const { data, loading, reload } = useApi<{ data: U[] }>("/users");
  const [edit, setEdit] = useState<U | "new" | null>(null); const [err, setErr] = useState("");
  async function toggle(u: U) { setErr(""); try { await api(`/users/${u.id}`, { method: "PATCH", json: { active: !u.active } }); reload(); } catch (e) { setErr((e as Error).message); } }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold">Staff & roles</h1><button className="btn-primary" onClick={() => setEdit("new")}>+ Add staff</button></div>
      <div className="card p-4 text-sm text-slate-600"><b>Admin</b>: everything · <b>Staff</b>: bookings, payments, trips, reports · <b>Trip staff</b>: view trips & passenger lists, mark boarding.</div>
      {err && <Alert>{err}</Alert>}
      {loading && !data ? <Spinner /> : (
        <div className="card overflow-x-auto"><table className="table-x">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Last login</th><th>Status</th><th /></tr></thead>
          <tbody>{data?.data.map((u) => (
            <tr key={u.id} className={u.active ? "" : "opacity-50"}>
              <td className="font-semibold">{u.name}</td><td>{u.email}</td><td>{u.phone}</td><td><StatusBadge s={u.role} /></td>
              <td className="text-xs text-slate-500">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never"}</td>
              <td>{u.active ? "Active" : "Deactivated"}</td>
              <td className="whitespace-nowrap text-right"><button className="btn-outline btn-sm" onClick={() => setEdit(u)}>Edit</button> <button className="btn-ghost btn-sm" onClick={() => toggle(u)}>{u.active ? "Deactivate" : "Activate"}</button></td>
            </tr>))}</tbody></table></div>
      )}
      {edit && <UserForm u={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </div>
  );
}
function UserForm({ u, onClose, onSaved }: { u: U | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: u?.name ?? "", email: u?.email ?? "", phone: u?.phone ?? "", role: u?.role ?? "STAFF", password: "" });
  const [err, setErr] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const body: Record<string, unknown> = { ...f, phone: f.phone || null }; if (u && !f.password) delete body.password;
    try { await api(u ? `/users/${u.id}` : "/users", { method: u ? "PATCH" : "POST", json: body }); onSaved(); } catch (ex) { setErr((ex as Error).message); }
  }
  return (
    <Modal open onClose={onClose} title={u ? "Edit staff" : "Add staff"}>
      <form onSubmit={save} className="space-y-3">
        <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
        <div><label className="label">Email (login)</label><input type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
        <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><label className="label">Role</label><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="ADMIN">Admin / Owner</option><option value="STAFF">Booking staff</option><option value="TRIP_STAFF">Trip staff</option></select></div>
        <div><label className="label">{u ? "New password (leave blank to keep)" : "Password"}</label><input type="password" className="input" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required={!u} autoComplete="new-password" /></div>
        {err && <Alert>{err}</Alert>}
        <button className="btn-primary w-full">Save</button>
      </form>
    </Modal>
  );
}
