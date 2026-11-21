"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatINR } from "@/lib/money";
import { fmtTime, durationLabel, TZ } from "@/lib/time";
import { Empty } from "@/components/ui";
import { brand } from "@/lib/brand";

type Trip = {
  id: string; departAt: string; arriveAt: string; fare: number; available: number; capacity: number; bookable: boolean; status: string;
  bus: { name: string; type: string; amenities: string[]; seatLayout: string | null };
  boardingStop: { id: string; name: string }; dropStop: { id: string; name: string };
};
const hourOf = (d: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(d)));
const SLOTS = [["morning", "Morning", "before 12 PM", 0, 12], ["afternoon", "Afternoon", "12 – 5 PM", 12, 17], ["evening", "Evening", "after 5 PM", 17, 24]] as const;

export function Results({ trips }: { trips: Trip[] }) {
  const [slots, setSlots] = useState<string[]>([]);
  const [ac, setAc] = useState<"" | "ac" | "nonac">("");
  const [sort, setSort] = useState<"time" | "price" | "seats">("time");
  const [onlyAvail, setOnlyAvail] = useState(false);

  const list = useMemo(() => {
    let l = trips.filter((t) => {
      const h = hourOf(t.departAt);
      if (slots.length && !SLOTS.some(([k, , , a, b]) => slots.includes(k) && h >= a && h < b)) return false;
      const isAc = /^ac\b|\bac\b/i.test(t.bus.type) && !/non[- ]?ac/i.test(t.bus.type);
      if (ac === "ac" && !isAc) return false; if (ac === "nonac" && isAc) return false;
      if (onlyAvail && !t.bookable) return false;
      return true;
    });
    l = [...l].sort((a, b) => sort === "price" ? a.fare - b.fare : sort === "seats" ? b.available - a.available : +new Date(a.departAt) - +new Date(b.departAt));
    return l;
  }, [trips, slots, ac, sort, onlyAvail]);

  if (!trips.length) return (
    <div className="mt-6"><Empty>
      <div className="text-3xl">🚌</div>
      <div className="mt-2 font-semibold text-slate-700">No buses found for this route and date</div>
      <p className="mt-1">Try another date, or <a className="font-semibold text-brand-700" href={`https://wa.me/${brand.whatsapp}`}>WhatsApp us</a> for help.</p>
    </Empty></div>
  );

  const toggle = (k: string) => setSlots((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]);
  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[240px_1fr]">
      <aside className="card h-fit space-y-5 p-4 lg:sticky lg:top-20">
        <div>
          <div className="label">Departure time</div>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            {SLOTS.map(([k, l, d]) => (
              <button key={k} onClick={() => toggle(k)} className={`rounded-lg border px-3 py-2 text-left text-xs ${slots.includes(k) ? "border-brand-600 bg-brand-50 text-brand-900" : "border-slate-200 hover:border-brand-200"}`}>
                <div className="font-semibold">{l}</div><div className="text-slate-500">{d}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label">Bus type</div>
          <div className="flex gap-2">{([["", "All"], ["ac", "AC"], ["nonac", "Non-AC"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setAc(k)} className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${ac === k ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200"}`}>{l}</button>
          ))}</div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} />Only show available</label>
        <div>
          <div className="label">Sort by</div>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as "time")}>
            <option value="time">Earliest departure</option><option value="price">Lowest fare</option><option value="seats">Most seats</option>
          </select>
        </div>
      </aside>

      <div className="space-y-3">
        {list.length === 0 && <Empty>No buses match these filters.</Empty>}
        {list.map((t) => {
          const low = t.available > 0 && t.available <= 5;
          return (
            <div key={t.id} className={`card p-4 transition sm:p-5 ${t.bookable ? "hover:border-brand-200 hover:shadow-md" : "opacity-70"}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-[180px]">
                  <div className="font-bold text-slate-900">{t.bus.name}</div>
                  <div className="text-xs text-slate-500">{t.bus.type}{t.bus.seatLayout ? ` · ${t.bus.seatLayout}` : ""}</div>
                  <div className="mt-2 flex flex-wrap gap-1">{t.bus.amenities.slice(0, 4).map((a) => <span key={a} className="badge bg-slate-100 text-slate-600">{a}</span>)}</div>
                </div>
                <div className="flex flex-1 items-center justify-center gap-3 sm:gap-5">
                  <div className="text-right"><div className="text-xl font-extrabold">{fmtTime(t.departAt)}</div><div className="max-w-[130px] truncate text-xs text-slate-500">{t.boardingStop.name}</div></div>
                  <div className="flex flex-col items-center text-[11px] text-slate-400"><span>{durationLabel(t.departAt, t.arriveAt)}</span><span className="my-0.5 h-px w-14 bg-slate-300" /></div>
                  <div><div className="text-xl font-extrabold text-slate-600">{fmtTime(t.arriveAt)}</div><div className="max-w-[130px] truncate text-xs text-slate-500">{t.dropStop.name}</div></div>
                </div>
                <div className="flex min-w-[150px] flex-col items-end gap-1">
                  <div className="text-xl font-extrabold text-brand-700">{formatINR(t.fare)}</div>
                  <div className={`text-xs font-semibold ${t.available === 0 ? "text-red-600" : low ? "text-amber-700" : "text-emerald-700"}`}>
                    {t.available === 0 ? "Sold out" : `${t.available} seat${t.available === 1 ? "" : "s"} left`}
                  </div>
                  {t.bookable
                    ? <Link href={`/trip/${t.id}?b=${t.boardingStop.id}&d=${t.dropStop.id}`} className="btn-primary mt-1 w-full">Select seats</Link>
                    : <span className="btn-outline btn-sm mt-1 w-full cursor-default">{t.available === 0 ? "Full" : "Booking closed"}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
