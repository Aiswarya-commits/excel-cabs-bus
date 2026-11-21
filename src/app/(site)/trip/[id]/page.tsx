import { notFound } from "next/navigation";
import { getTripDetail } from "@/server/trips";
import { BookingFlow } from "./BookingFlow";
import { fmtDate, fmtTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose seats" };

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ b?: string; d?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const trip = await getTripDetail(id).catch(() => null);
  if (!trip) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">{fmtDate(trip.travelDate)} · {fmtTime(trip.departAt)}</div>
        <h1 className="text-2xl font-extrabold text-slate-900">{trip.route.name}</h1>
        <div className="text-sm text-slate-500">{trip.bus.name} · {trip.bus.type}{trip.route.distanceKm ? ` · ${trip.route.distanceKm} km` : ""}</div>
      </div>
      <BookingFlow trip={JSON.parse(JSON.stringify(trip))} initialBoard={sp.b} initialDrop={sp.d} />
    </div>
  );
}
