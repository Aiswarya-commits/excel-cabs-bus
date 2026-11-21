"use client";
import { useEffect, type ReactNode } from "react";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" /><path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal aria-label={title} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-3.5">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost btn-sm" aria-label="Close">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "success" | "info" | "warn"; children: ReactNode }) {
  const c = { error: "bg-red-50 text-red-800 border-red-200", success: "bg-emerald-50 text-emerald-800 border-emerald-200", info: "bg-brand-50 text-brand-900 border-brand-100", warn: "bg-amber-50 text-amber-900 border-amber-200" }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3.5 py-2.5 text-sm ${c}`}>{children}</div>;
}

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-emerald-100 text-emerald-800", PENDING: "bg-amber-100 text-amber-900", CANCELLED: "bg-red-100 text-red-700",
  COMPLETED: "bg-slate-200 text-slate-700", NO_SHOW: "bg-slate-800 text-white",
  PAID: "bg-emerald-100 text-emerald-800", PARTIAL: "bg-amber-100 text-amber-900", UNPAID: "bg-red-100 text-red-700",
  POST_TRAVEL: "bg-violet-100 text-violet-800", REFUNDED: "bg-slate-200 text-slate-700", PARTIAL_REFUND: "bg-slate-200 text-slate-700",
  OPEN: "bg-emerald-100 text-emerald-800", SCHEDULED: "bg-brand-100 text-brand-900",
  BOARDED: "bg-emerald-100 text-emerald-800", NOT_CHECKED: "bg-slate-100 text-slate-600",
  ONLINE: "bg-brand-100 text-brand-900", WHATSAPP: "bg-green-100 text-green-800", PHONE: "bg-sky-100 text-sky-800", COUNTER: "bg-orange-100 text-orange-800",
  ADMIN: "bg-brand-600 text-white", STAFF: "bg-brand-100 text-brand-900", TRIP_STAFF: "bg-slate-200 text-slate-700",
};
export const LABELS: Record<string, string> = {
  POST_TRAVEL: "Pay after travel", PARTIAL: "Partially paid", PARTIAL_REFUND: "Partly refunded", NO_SHOW: "No-show",
  NOT_CHECKED: "Not checked", OPEN: "Booking open", PENDING: "Pending confirmation", TRIP_STAFF: "Trip staff", WHATSAPP: "WhatsApp",
};
export const label = (s: string) => LABELS[s] ?? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
export function StatusBadge({ s }: { s: string }) {
  return <span className={`badge ${STATUS_STYLES[s] ?? "bg-slate-100 text-slate-700"}`}>{label(s)}</span>;
}

export function Stat({ title, value, sub, tone = "default" }: { title: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  const t = { default: "text-slate-900", good: "text-emerald-700", warn: "text-amber-700", bad: "text-red-700" }[tone];
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className={`mt-1 text-2xl font-extrabold ${t}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">{children}</div>;
}

export function OccupancyBar({ booked, capacity }: { booked: number; capacity: number }) {
  const pct = capacity ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
  const c = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200"><div className={`h-full ${c}`} style={{ width: `${pct}%` }} /></div>
      <span className="text-xs tabular-nums text-slate-600">{booked}/{capacity}</span>
    </div>
  );
}
