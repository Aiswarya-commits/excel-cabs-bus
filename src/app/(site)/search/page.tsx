import Link from "next/link";
import type { Metadata } from "next";
import { SearchForm } from "@/components/SearchForm";
import { Results } from "./Results";
import { listPlaces, searchTrips } from "@/server/trips";
import { addDays, fmtDate, todayLocal } from "@/lib/time";

export const dynamic = "force-dynamic";
type SP = Promise<{ from?: string; to?: string; date?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const s = await searchParams;
  return { title: s.from && s.to ? `${s.from} to ${s.to} buses` : "Search buses" };
}

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const s = await searchParams;
  const today = todayLocal();
  const date = s.date && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && s.date >= today ? s.date : today;
  const [places, trips] = await Promise.all([listPlaces(), s.from && s.to ? searchTrips(s.from, s.to, date) : Promise.resolve([])]);
  const q = (d: string) => `/search?from=${encodeURIComponent(s.from ?? "")}&to=${encodeURIComponent(s.to ?? "")}&date=${d}`;
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 3)).filter((d) => d >= today).slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <SearchForm places={places} initial={{ from: s.from, to: s.to, date }} compact />
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => (
          <Link key={d} href={q(d)} className={`shrink-0 rounded-lg border px-4 py-2 text-center text-xs font-semibold ${d === date ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-200"}`}>
            {fmtDate(d).replace(/, \d{4}$/, "")}
          </Link>
        ))}
      </div>
      <h1 className="mt-5 text-lg font-bold text-slate-900">
        {s.from && s.to ? <>{s.from} → {s.to} <span className="font-normal text-slate-500">· {fmtDate(date)} · {trips.length} bus{trips.length === 1 ? "" : "es"}</span></> : "Search for a bus"}
      </h1>
      <Results trips={JSON.parse(JSON.stringify(trips))} />
    </div>
  );
}
