"use client";
import Link from "next/link";
import { use, useState } from "react";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { formatINR, fromPaise } from "@/lib/money";
import { fmtDate, fmtTime, fmtDateTime } from "@/lib/time";
import { Alert, Modal, Spinner, StatusBadge, label } from "@/components/ui";
import { useActor } from "../../AdminShell";

type Payment = { id: string; kind: string; amount: string; method: string; txnReference: string | null; note: string | null; receivedAt: string; voidedAt: string | null; voidReason: string | null; recordedBy: { name: string } | null };
type B = {
  id: string; reference: string; status: string; paymentStatus: string; source: string; postTravel: boolean; contactName: string; contactPhone: string; contactEmail: string | null; notes: string | null; createdAt: string;
  totalPaise: number; paid: number; refunded: number; net: number; balance: number; boardingTime: string; ticketUrl: string;
  trip: { id: string; travelDate: string; departAt: string; route: { name: string }; bus: { name: string; registration: string } };
  boardingStop: { name: string } | null; dropStop: { name: string } | null; createdBy: { name: string } | null;
  passengers: { id: string; seatNumber: string | null; fare: string; boarding: string; passenger: { name: string; age: number | null; gender: string | null } }[];
  payments: Payment[]; cancellation: { reason: string; cancelledAt: string; refundAmount: string; refundStatus: string; cancelledBy: { name: string } | null } | null;
  history: { id: string; action: string; actorName: string; createdAt: string; changes: Record<string, unknown> | null }[];
};

export default function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const actor = useActor(); const canEdit = actor.role !== "TRIP_STAFF";
  const { data, loading, error, reload } = useApi<{ data: B }>(`/bookings/${id}`);
  const [modal, setModal] = useState<"" | "pay" | "refund" | "cancel" | "edit">("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const b = data?.data;

  async function act(fn: () => Promise<unknown>, ok: string) {
    setErr(""); setMsg("");
    try { await fn(); setMsg(ok); setModal(""); await reload(); } catch (e) { setErr((e as Error).message); }
  }

  if (loading && !b) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8 text-brand-600" /></div>;
  if (error || !b) return <Alert>{error || "Not found"}</Alert>;
  const active = b.status !== "CANCELLED";
  const waText = `Hi ${b.contactName}, your Excel Cabs booking ${b.reference} for ${b.trip.route.name} on ${fmtDate(b.trip.travelDate)} at ${fmtTime(b.boardingTime)} is ${b.status === "CONFIRMED" ? "confirmed" : label(b.status).toLowerCase()}.${b.balance ? ` Balance due: ${formatINR(b.balance)}.` : ""}\nTicket: ${typeof window !== "undefined" ? location.origin : ""}${b.ticketUrl}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/bookings" className="text-xs font-semibold text-brand-700">← Bookings</Link>
          <h1 className="mt-1 font-mono text-2xl font-extrabold tracking-wider">{b.reference}</h1>
          <div className="mt-1 flex flex-wrap gap-2"><StatusBadge s={b.status} /><StatusBadge s={b.paymentStatus} /><StatusBadge s={b.source} />{b.postTravel && <span className="badge bg-violet-100 text-violet-800">Post-travel collection</span>}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && b.status === "PENDING" && <button className="btn-primary" onClick={() => act(() => api(`/bookings/${id}`, { method: "PATCH", json: { status: "CONFIRMED" } }), "Booking confirmed")}>✓ Confirm booking</button>}
          <a className="btn-outline" target="_blank" rel="noopener" href={`https://wa.me/91${b.contactPhone}?text=${encodeURIComponent(waText)}`}>💬 WhatsApp</a>
          <a className="btn-outline" target="_blank" rel="noopener" href={b.ticketUrl}>🎫 Ticket</a>
          {canEdit && active && <button className="btn-outline" onClick={() => setModal("edit")}>Edit</button>}
          {canEdit && active && <button className="btn-danger" onClick={() => setModal("cancel")}>Cancel</button>}
        </div>
      </div>
      {msg && <Alert tone="success">{msg}</Alert>}
      {err && !modal && <Alert>{err}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="card grid gap-4 p-5 sm:grid-cols-3">
            <div><div className="label">Trip</div><Link href={`/admin/trips/${b.trip.id}`} className="font-semibold text-brand-700">{b.trip.route.name}</Link><div className="text-sm text-slate-500">{fmtDate(b.trip.travelDate)} · {fmtTime(b.trip.departAt)}</div><div className="text-xs text-slate-500">{b.trip.bus.name} · {b.trip.bus.registration}</div></div>
            <div><div className="label">Boarding → Drop</div><div className="font-semibold">{b.boardingStop?.name} → {b.dropStop?.name}</div><div className="text-sm text-slate-500">Boards {fmtTime(b.boardingTime)}</div></div>
            <div><div className="label">Contact</div><div className="font-semibold">{b.contactName}</div><a href={`tel:+91${b.contactPhone}`} className="text-sm text-brand-700">+91 {b.contactPhone}</a>{b.contactEmail && <div className="text-xs text-slate-500">{b.contactEmail}</div>}</div>
            {b.notes && <div className="sm:col-span-3"><div className="label">Notes</div><p className="text-sm">{b.notes}</p></div>}
            <div className="text-xs text-slate-400 sm:col-span-3">Created {fmtDateTime(b.createdAt)} by {b.createdBy?.name ?? "passenger (online)"}</div>
          </div>

          <div className="card overflow-hidden">
            <h2 className="border-b px-4 py-3 font-bold">Passengers ({b.passengers.length})</h2>
            <table className="table-x"><thead><tr><th>Seat</th><th>Name</th><th>Age</th><th>Fare</th><th>Boarding</th></tr></thead>
              <tbody>{b.passengers.map((p) => (
                <tr key={p.id}><td className="font-bold text-brand-700">{p.seatNumber ?? "—"}</td><td>{p.passenger.name}</td><td>{p.passenger.age ?? "—"}</td><td>₹{p.fare}</td>
                  <td>{active ? <select className="input w-auto py-1 text-xs" value={p.boarding} onChange={(e) => act(() => api(`/booking-passengers/${p.id}/boarding`, { method: "PATCH", json: { status: e.target.value } }), "Boarding updated")}>
                    <option value="NOT_CHECKED">Not checked</option><option value="BOARDED">Boarded</option><option value="NO_SHOW">No-show</option></select> : <StatusBadge s={p.boarding} />}</td></tr>))}</tbody></table>
          </div>

          <div className="card p-4">
            <h2 className="font-bold">History</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-brand-100 pl-4">
              {b.history.map((h) => (
                <li key={h.id} className="text-sm"><div className="font-semibold">{h.action.replace(".", " · ")}</div>
                  <div className="text-xs text-slate-500">{fmtDateTime(h.createdAt)} · {h.actorName}</div>
                  {h.changes && !("seed" in h.changes) && <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600">{JSON.stringify(h.changes, null, 1)}</pre>}
                </li>))}
            </ol>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <h2 className="font-bold">Payment</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Total fare</dt><dd className="font-semibold">{formatINR(b.totalPaise)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Received</dt><dd>{formatINR(b.paid)}</dd></div>
              {b.refunded > 0 && <div className="flex justify-between"><dt className="text-slate-500">Refunded</dt><dd>−{formatINR(b.refunded)}</dd></div>}
              <div className="flex justify-between border-t pt-1.5 text-lg font-extrabold"><dt>Balance</dt><dd className={b.balance ? "text-red-600" : "text-emerald-700"}>{formatINR(b.balance)}</dd></div>
            </dl>
            {canEdit && <div className="mt-3 flex gap-2">
              {active && b.balance > 0 && <button className="btn-primary flex-1" onClick={() => setModal("pay")}>+ Record payment</button>}
              {b.net > 0 && <button className="btn-outline flex-1" onClick={() => setModal("refund")}>Refund</button>}
            </div>}
            {canEdit && active && <label className="mt-3 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" className="accent-brand-600" checked={b.postTravel} onChange={(e) => act(() => api(`/bookings/${id}`, { method: "PATCH", json: { postTravel: e.target.checked } }), "Updated")} />Collect balance after travel</label>}
          </div>
          {b.cancellation && <div className="card border-red-200 bg-red-50 p-4 text-sm"><h2 className="font-bold text-red-800">Cancelled</h2><p className="mt-1">{b.cancellation.reason}</p><p className="mt-1 text-xs text-red-700">{fmtDateTime(b.cancellation.cancelledAt)} · {b.cancellation.cancelledBy?.name} · Refund ₹{b.cancellation.refundAmount} ({label(b.cancellation.refundStatus)})</p></div>}
          <div className="card overflow-hidden">
            <h2 className="border-b px-4 py-3 font-bold">Payment history</h2>
            {b.payments.length === 0 ? <p className="p-4 text-sm text-slate-500">No payments yet.</p> : (
              <ul className="divide-y">{b.payments.map((p) => (
                <li key={p.id} className={`px-4 py-3 text-sm ${p.voidedAt ? "opacity-50" : ""}`}>
                  <div className="flex justify-between"><span className={`font-bold ${p.kind === "REFUND" ? "text-red-600" : "text-emerald-700"}`}>{p.kind === "REFUND" ? "−" : "+"}₹{p.amount}</span><span className="badge bg-slate-100">{p.method}</span></div>
                  <div className="text-xs text-slate-500">{fmtDateTime(p.receivedAt)} · {p.recordedBy?.name}{p.txnReference ? ` · ${p.txnReference}` : ""}</div>
                  {p.note && <div className="text-xs">{p.note}</div>}
                  {p.voidedAt ? <div className="text-xs font-semibold text-red-600 line-through-none">VOID: {p.voidReason}</div>
                    : canEdit && <button className="mt-1 text-xs font-semibold text-red-600 hover:underline" onClick={() => { const r = prompt("Reason for voiding this payment entry?"); if (r) act(() => api(`/payments/${p.id}/void`, { method: "POST", json: { reason: r } }), "Payment voided"); }}>Void entry</button>}
                </li>))}</ul>
            )}
          </div>
        </aside>
      </div>

      <PaymentModal open={modal === "pay" || modal === "refund"} kind={modal === "refund" ? "REFUND" : "PAYMENT"} max={modal === "refund" ? b.net : b.balance} onClose={() => { setModal(""); setErr(""); }} err={err}
        onSubmit={(v) => act(() => api(`/bookings/${id}/payments`, { method: "POST", json: v }), modal === "refund" ? "Refund recorded" : "Payment recorded")} />
      <CancelModal open={modal === "cancel"} paid={b.net} onClose={() => { setModal(""); setErr(""); }} err={err}
        onSubmit={(v) => act(() => api(`/bookings/${id}/cancel`, { method: "POST", json: v }), "Booking cancelled")} />
      <EditModal open={modal === "edit"} b={b} onClose={() => { setModal(""); setErr(""); }} err={err}
        onSubmit={(v) => act(() => api(`/bookings/${id}`, { method: "PATCH", json: v }), "Booking updated")} />
    </div>
  );
}

function PaymentModal({ open, kind, max, onClose, onSubmit, err }: { open: boolean; kind: "PAYMENT" | "REFUND"; max: number; onClose: () => void; onSubmit: (v: object) => void; err: string }) {
  const [amount, setAmount] = useState(""); const [method, setMethod] = useState("UPI"); const [txn, setTxn] = useState(""); const [note, setNote] = useState("");
  return (
    <Modal open={open} onClose={onClose} title={kind === "REFUND" ? "Record refund" : "Record payment"}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ kind, amount, method, txnReference: txn || null, note: note || null }); }}>
        <div><label className="label">Amount (max {formatINR(max)})</label>
          <div className="flex gap-2"><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus /><button type="button" className="btn-outline" onClick={() => setAmount(fromPaise(max))}>Full</button></div></div>
        <div className="grid grid-cols-4 gap-1">{["UPI", "CASH", "BANK", "OTHER"].map((m) => <button type="button" key={m} onClick={() => setMethod(m)} className={`rounded-md border py-2 text-xs font-semibold ${method === m ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200"}`}>{m}</button>)}</div>
        <input className="input" placeholder="Transaction / UPI reference" value={txn} onChange={(e) => setTxn(e.target.value)} />
        <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {err && <Alert>{err}</Alert>}
        <button className="btn-primary w-full">Save</button>
      </form>
    </Modal>
  );
}

function CancelModal({ open, paid, onClose, onSubmit, err }: { open: boolean; paid: number; onClose: () => void; onSubmit: (v: object) => void; err: string }) {
  const [reason, setReason] = useState(""); const [refund, setRefund] = useState("0"); const [status, setStatus] = useState("PENDING"); const [method, setMethod] = useState("UPI");
  return (
    <Modal open={open} onClose={onClose} title="Cancel booking">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ reason, refundAmount: refund || "0", refundStatus: Number(refund) > 0 ? status : "NONE", refundMethod: method }); }}>
        <Alert tone="warn">Seats will be released immediately. This cannot be undone.</Alert>
        <div><label className="label">Reason *</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="e.g. Customer request via WhatsApp" autoFocus /></div>
        {paid > 0 && <>
          <div><label className="label">Refund amount (received {formatINR(paid)})</label><input className="input" inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value)} /></div>
          {Number(refund) > 0 && <div className="grid grid-cols-2 gap-2">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="PENDING">Refund pending</option><option value="REFUNDED">Refunded now</option></select>
            {status === "REFUNDED" && <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{["UPI", "CASH", "BANK", "OTHER"].map((m) => <option key={m}>{m}</option>)}</select>}
          </div>}
        </>}
        {err && <Alert>{err}</Alert>}
        <button className="btn-danger w-full">Cancel booking</button>
      </form>
    </Modal>
  );
}

function EditModal({ open, b, onClose, onSubmit, err }: { open: boolean; b: B; onClose: () => void; onSubmit: (v: object) => void; err: string }) {
  const [name, setName] = useState(b.contactName); const [phone, setPhone] = useState(b.contactPhone); const [email, setEmail] = useState(b.contactEmail ?? ""); const [notes, setNotes] = useState(b.notes ?? "");
  const [pax, setPax] = useState(b.passengers.map((p) => ({ id: p.id, name: p.passenger.name, seatNumber: p.seatNumber ?? "" })));
  return (
    <Modal open={open} onClose={onClose} title="Edit booking" wide>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ contactName: name, contactPhone: phone, contactEmail: email, notes, passengers: pax.map((p) => ({ id: p.id, name: p.name, seatNumber: p.seatNumber || null })) }); }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label">Contact name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="label">Mobile</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div><label className="label">Notes</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="label">Passengers</div>
        {pax.map((p, i) => <div key={p.id} className="grid grid-cols-[1fr_90px] gap-2">
          <input className="input" value={p.name} onChange={(e) => setPax((a) => a.map((x, k) => k === i ? { ...x, name: e.target.value } : x))} />
          <input className="input" placeholder="Seat" value={p.seatNumber} onChange={(e) => setPax((a) => a.map((x, k) => k === i ? { ...x, seatNumber: e.target.value } : x))} />
        </div>)}
        {err && <Alert>{err}</Alert>}
        <button className="btn-primary w-full">Save changes</button>
        <p className="text-xs text-slate-400">All changes are recorded in the booking history.</p>
      </form>
    </Modal>
  );
}
