import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { listPlaces, popularRoutes } from "@/server/trips";
import { brand } from "@/lib/brand";
import { formatINR } from "@/lib/money";
import { todayLocal } from "@/lib/time";

export const dynamic = "force-dynamic";

const FEATURES = [
  ["⚡", "Book in 60 seconds", "No sign-up, no app download. Just your name and phone number."],
  ["💺", "Live seat availability", "Pick your exact seat from a real-time seat map — never overbooked."],
  ["💸", "Pay your way", "UPI, cash at the counter or on board. Pay later is available on select trips."],
  ["📍", "Board anywhere on route", "Choose any boarding and drop-off point along the way."],
  ["🎫", "Instant e-ticket", "Get a QR ticket you can save, print or share on WhatsApp."],
  ["🛟", "Real humans to help", `Call or WhatsApp us ${brand.supportHours}.`],
];

export default async function Home() {
  const [places, popular] = await Promise.all([listPlaces(), popularRoutes(6)]);
  const today = todayLocal();
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 pb-24 pt-12 text-white sm:pt-16">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4">
          <span className="badge bg-accent text-white">New · Online seat booking</span>
          <h1 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">Local bus tickets, booked in seconds.</h1>
          <p className="mt-3 max-w-xl text-brand-100 sm:text-lg">Search {brand.name} buses, choose your seat and get your e-ticket instantly. Pay by UPI or cash — no login needed.</p>
        </div>
      </section>
      <div className="relative mx-auto -mt-16 max-w-6xl px-4"><SearchForm places={places} /></div>

      {popular.length > 0 && (
        <section className="mx-auto mt-12 max-w-6xl px-4">
          <h2 className="text-xl font-bold text-slate-900">Popular routes</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((r) => (
              <Link key={r.origin + r.destination} href={`/search?from=${encodeURIComponent(r.origin)}&to=${encodeURIComponent(r.destination)}&date=${today}`}
                className="card group flex items-center justify-between p-4 transition hover:border-brand-200 hover:shadow-md">
                <div>
                  <div className="font-semibold text-slate-900">{r.origin} <span className="text-brand-600">→</span> {r.destination}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{r.tripCount} upcoming departures</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">from</div>
                  <div className="font-bold text-brand-700">{formatINR(r.minFare)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto mt-14 max-w-6xl px-4">
        <h2 className="text-xl font-bold text-slate-900">Why travel with {brand.name}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([i, t, d]) => (
            <div key={t} className="card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-xl">{i}</div>
              <div className="mt-3 font-semibold text-slate-900">{t}</div>
              <p className="mt-1 text-sm text-slate-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-6xl px-4">
        <div className="card grid gap-6 overflow-hidden p-6 sm:grid-cols-3 sm:p-8">
          {[["1", "Search", "Pick From, To and your travel date."], ["2", "Choose", "Select a bus, your seats and boarding point."], ["3", "Travel", "Show your e-ticket and pay by UPI or cash."]].map(([n, t, d]) => (
            <div key={n} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{n}</div>
              <div><div className="font-semibold">{t}</div><div className="text-sm text-slate-500">{d}</div></div>
            </div>
          ))}
        </div>
      </section>

      <section id="help" className="mx-auto mt-14 grid max-w-6xl gap-6 px-4 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-lg font-bold">Cancellation policy</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">{brand.cancellationPolicy.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="mt-3 text-sm text-slate-500">To cancel, contact us with your booking reference.</p>
        </div>
        <div className="card bg-brand-50 p-6">
          <h2 className="text-lg font-bold text-brand-900">Need help?</h2>
          <p className="mt-2 text-sm text-brand-900/80">Group booking, special request or change of plans? Our team is available {brand.supportHours}.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn-primary" href={`tel:${brand.phone.replace(/\s/g, "")}`}>📞 Call {brand.phone}</a>
            <a className="btn-outline" href={`https://wa.me/${brand.whatsapp}?text=${encodeURIComponent("Hi Excel Cabs, I need help with a bus booking.")}`} target="_blank" rel="noopener">💬 WhatsApp</a>
          </div>
        </div>
      </section>
    </>
  );
}
