"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { todayLocal, addDays } from "@/lib/time";

export function SearchForm({ places, initial, compact }: { places: string[]; initial?: { from?: string; to?: string; date?: string }; compact?: boolean }) {
  const router = useRouter();
  const today = todayLocal();
  const [from, setFrom] = useState(initial?.from ?? "");
  const [to, setTo] = useState(initial?.to ?? "");
  const [date, setDate] = useState(initial?.date ?? today);
  const [err, setErr] = useState("");

  useEffect(() => { // remember last search for returning passengers
    if (initial?.from) return;
    try { const s = JSON.parse(localStorage.getItem("ec:lastSearch") || "null"); if (s) { setFrom(s.from); setTo(s.to); } } catch {}
  }, [initial?.from]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return setErr("Please choose where you are leaving from and going to.");
    if (from.trim().toLowerCase() === to.trim().toLowerCase()) return setErr("From and To can't be the same place.");
    setErr("");
    try { localStorage.setItem("ec:lastSearch", JSON.stringify({ from, to })); } catch {}
    router.push(`/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}`);
  }
  const chip = (d: string, l: string) => (
    <button type="button" onClick={() => setDate(d)} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${date === d ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700 hover:bg-brand-100"}`}>{l}</button>
  );

  return (
    <form onSubmit={submit} className={`card ${compact ? "p-3" : "p-4 sm:p-5"}`}>
      <datalist id="places">{places.map((p) => <option key={p} value={p} />)}</datalist>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_200px_auto] md:items-end">
        <div>
          <label className="label" htmlFor="from">From</label>
          <input id="from" list="places" className="input text-base font-semibold" placeholder="Leaving from" value={from} onChange={(e) => setFrom(e.target.value)} autoComplete="off" />
        </div>
        <button type="button" aria-label="Swap from and to" onClick={() => { setFrom(to); setTo(from); }} className="mx-auto -my-1 flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-brand-700 hover:bg-brand-50 md:my-0">⇄</button>
        <div>
          <label className="label" htmlFor="to">To</label>
          <input id="to" list="places" className="input text-base font-semibold" placeholder="Going to" value={to} onChange={(e) => setTo(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="date">Date of journey</label>
          <input id="date" type="date" className="input text-base font-semibold" min={today} max={addDays(today, 90)} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn-primary h-[46px] px-7 text-base">Search buses</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {chip(today, "Today")}{chip(addDays(today, 1), "Tomorrow")}{chip(addDays(today, 2), "Day after")}
        {err && <span className="ml-auto text-sm font-medium text-red-600">{err}</span>}
      </div>
    </form>
  );
}
