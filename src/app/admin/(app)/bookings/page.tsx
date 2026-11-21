"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { formatINR } from "@/lib/money";
import { fmtDate, fmtTime, fmtDateTime } from "@/lib/time";
import { Alert, Empty, Spinner, StatusBadge } from "@/components/ui";

type Row = { id: string; reference: string; status: string; paymentStatus: string; source: string; contactName: string; contactPhone: string; createdAt: string; total: number; paid: number; balance: number; passengers: number; seats: string | null; travelDate: string; departAt: string; routeName: string };
type Res = { data: Row[]; meta: { page: number; pageSize: number; total: number } };

function BookingsInner() {
  const sp = useSearchParams(); const router = useRouter();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [f, setF] = useState({ date: sp.get("date") ?? "", status: sp.get("status") ?? "", paymentStatus: sp.get("paymentStatus") ?? "", source: sp.get("source") ?? "", page: Number(sp.get("page") ?? 1) });
  const [debounced, setDebounced] = useState(q);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);
  const qs = useMemo(() => {
    const p = new URLSearchParams(); if (debounced) p.set("q", debounced);
    Object.entries(f).forEach(([k, v]) => v && p.set(k, String(v))); p.set("pageSize", "25"); return p.toString();
  }, [debounced, f]);
  useEffect(() => { router.replace(`/admin/bookings?${qs}`, { scroll: false }); }, [qs, router]);
  const { data, loading, error } = useApi<Res>(`/bookings?${qs}`);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v, page: 1 }));
  const pages = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Bookings</h1>
        <Link href="/admin/bookings/new" className="btn-primary">+ New booking</Link>
      </div>
      <div className="card grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <input className="input" placeholder="Search ref, name or phone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" autoFocus />
        <input type="date" className="input" value={f.date} onChange={(e) => set("date", e.target.value)} aria-label="Travel date" />
        <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)} aria-label="Booking status">
          <option value="">All statuses</option>{["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={f.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)} aria-label="Payment status">
          <option value="">All payments</option>{["UNPAID", "PARTIAL", "PAID", "POST_TRAVEL", "REFUNDED", "PARTIAL_REFUND"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select className="input" value={f.source} onChange={(e) => set("source", e.target.value)} aria-label="Source">
          <option value="">All sources</option>{["ONLINE", "WHATSAPP", "PHONE", "COUNTER"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="card overflow-hidden">
        {loading && !data ? <div className="flex justify-center p-10"><Spinner className="h-6 w-6 text-brand-600" /></div> :
         !data?.data.length ? <div className="p-4"><Empty>No bookings match.</Empty></div> : (
          <div className="overflow-x-auto"><table className="table-x">
            <thead><tr><th>Ref</th><th>Passenger</th><th>Trip</th><th>Pax / seats</th><th>Source</th><th>Status</th><th>Payment</th><th className="text-right">Total</th><th className="text-right">Balance</th></tr></thead>
            <tbody>{data.data.map((b) => (
              <tr key={b.id} className="cursor-pointer" onClick={() => router.push(`/admin/bookings/${b.id}`)}>
                <td><Link href={`/admin/bookings/${b.id}`} className="font-mono font-bold text-brand-700" onClick={(e) => e.stopPropagation()}>{b.reference}</Link><div className="text-[11px] text-slate-400">{fmtDateTime(b.createdAt)}</div></td>
                <td><div className="font-medium">{b.contactName}</div><div className="text-xs text-slate-500">{b.contactPhone}</div></td>
                <td><div className="text-sm">{b.routeName}</div><div className="text-xs text-slate-500">{fmtDate(b.travelDate)} · {fmtTime(b.departAt)}</div></td>
                <td>{b.passengers}{b.seats ? <span className="text-xs text-slate-500"> · {b.seats}</span> : null}</td>
                <td><StatusBadge s={b.source} /></td><td><StatusBadge s={b.status} /></td><td><StatusBadge s={b.paymentStatus} /></td>
                <td className="text-right tabular-nums">{formatINR(b.total)}</td>
                <td className={`text-right font-semibold tabular-nums ${b.balance ? "text-red-600" : "text-emerald-700"}`}>{formatINR(b.balance)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
        {data && data.meta.total > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm text-slate-500">
            <span>{data.meta.total} bookings</span>
            <div className="flex items-center gap-2">
              <button className="btn-outline btn-sm" disabled={f.page <= 1} onClick={() => setF((x) => ({ ...x, page: x.page - 1 }))}>← Prev</button>
              <span>Page {f.page} / {pages}</span>
              <button className="btn-outline btn-sm" disabled={f.page >= pages} onClick={() => setF((x) => ({ ...x, page: x.page + 1 }))}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default function BookingsPage() { return <Suspense><BookingsInner /></Suspense>; }
