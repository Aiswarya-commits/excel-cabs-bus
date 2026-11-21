"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, ClientError } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { formatINR, fromPaise, toPaise } from "@/lib/money";
import { fmtTime, todayLocal, addDays } from "@/lib/time";
import { Alert, Spinner, OccupancyBar } from "@/components/ui";
import { SeatMap } from "@/components/SeatMap";

type TripRow = { id: string; departAt: string; fare: number; status: string; route: { name: string }; bus: { name: string }; capacity: number; booked: number };
type Stop = { id: string; name: string; sequence: number; isBoarding: boolean; isDropoff: boolean; time: string };
type TripDetail = { id: string; fare: number; capacity: number; available: number; takenSeats: string[]; bus: { seatLayout: string | null }; stops: Stop[] };
type PayMode = "UNPAID" | "FULL" | "PARTIAL" | "POST_TRAVEL";

export default function NewBooking() {
  const [date, setDate] = useState(todayLocal());
  const { data: tripsRes, loading: tl } = useApi<{ data: TripRow[] }>(`/trips?from=${date}&to=${date}&status=OPEN,SCHEDULED`);
  const [tripId, setTripId] = useState("");
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [phone, setPhone] = useState(""); const [name, setName] = useState("");
  const [dups, setDups] = useState<{ reference: string; id: string; contactName: string }[]>([]);
  const [count, setCount] = useState(1); const [seats, setSeats] = useState<string[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [board, setBoard] = useState(""); const [drop, setDrop] = useState("");
  const [source, setSource] = useState("WHATSAPP"); const [notes, setNotes] = useState("");
  const [fareOverride, setFareOverride] = useState("");
  const [pay, setPay] = useState<PayMode>("UNPAID"); const [method, setMethod] = useState("UPI"); const [amount, setAmount] = useState(""); const [txn, setTxn] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [done, setDone] = useState<{ id: string; reference: string; ticketUrl: string; text: string } | null>(null);

  async function loadTrip(id: string) {
    setTrip(null); setSeats([]); if (!id) return;
    const r = await api<{ data: TripDetail }>(`/trips/${id}`); setTrip(r.data);
    setBoard(r.data.stops.find((s) => s.isBoarding)?.id ?? ""); setDrop(r.data.stops[r.data.stops.length - 1]?.id ?? "");
  }
  useEffect(() => { loadTrip(tripId); }, [tripId]);

  // Phone → duplicate check + auto-fill returning customer's name
  useEffect(() => {
    const d = phone.replace(/\D/g, "").slice(-10);
    if (d.length !== 10) { setDups([]); return; }
    const t = setTimeout(async () => {
      if (tripId) api<{ data: typeof dups }>(`/bookings/check-duplicate?tripId=${tripId}&phone=${d}`).then((r) => setDups(r.data)).catch(() => {});
      if (!name) api<{ data: { contactName: string }[] }>(`/bookings?q=${d}&pageSize=1`).then((r) => { if (r.data[0]) setName((n) => n || r.data[0].contactName); }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [phone, tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasSeats = !!trip?.bus.seatLayout;
  const n = hasSeats ? Math.max(seats.length, 0) || count : count;
  const fare = fareOverride && /^\d+(\.\d{1,2})?$/.test(fareOverride) ? toPaise(fareOverride) : trip?.fare ?? 0;
  const total = fare * n;
  const boardSeq = trip?.stops.find((s) => s.id === board)?.sequence ?? 0;

  async function submit(e: React.FormEvent, allowDuplicate = false) {
    e.preventDefault(); setErr("");
    if (!trip) return setErr("Select a trip first.");
    if (name.trim().length < 2) return setErr("Enter the customer name.");
    setBusy(true);
    const payAmt = pay === "FULL" ? fromPaise(total) : pay === "PARTIAL" ? amount : null;
    try {
      const passengers = Array.from({ length: n }, (_, i) => ({ name: names[i]?.trim() || (i === 0 ? name : `${name} (guest ${i + 1})`), seatNumber: hasSeats ? seats[i] ?? null : null }));
      const r = await api<{ data: { id: string; reference: string; ticketUrl: string } }>("/bookings", { method: "POST", json: {
        tripId: trip.id, contactName: name, contactPhone: phone, passengers, boardingStopId: board, dropStopId: drop, notes: notes || null,
        source, status: "CONFIRMED", postTravel: pay === "POST_TRAVEL", farePerPassenger: fareOverride || null, allowDuplicate,
        initialPayment: payAmt ? { amount: payAmt, method, txnReference: txn || null } : null,
      } });
      const tripRow = tripsRes?.data.find((t) => t.id === trip.id);
      const bStop = trip.stops.find((s) => s.id === board); const dStop = trip.stops.find((s) => s.id === drop);
      const paid = payAmt ? toPaise(payAmt) : 0;
      const text = [`🚌 *Excel Cabs — Booking Confirmed*`, `Ref: *${r.data.reference}*`, `${tripRow?.route.name ?? ""}`, `📅 ${date} · ⏰ ${bStop ? fmtTime(bStop.time) : ""}`,
        `📍 ${bStop?.name} → ${dStop?.name}`, `👥 ${n} passenger(s)${hasSeats && seats.length ? ` · Seats ${seats.join(", ")}` : ""}`,
        `💰 Total ${formatINR(total)}${total - paid > 0 ? ` · Balance ${formatINR(total - paid)}` : " · Paid"}`, `Ticket: ${location.origin}${r.data.ticketUrl}`].join("\n");
      setDone({ ...r.data, text });
    } catch (ex) {
      const ce = ex as ClientError;
      if (ce.code === "DUPLICATE") { if (confirm(`${ce.message}\n\nCreate another booking anyway?`)) { setBusy(false); return submit(e, true); } }
      if (ce.code === "SEAT_TAKEN" || ce.code === "CAPACITY") loadTrip(trip.id);
      setErr(ce.message);
    } finally { setBusy(false); }
  }

  function reset() {
    setDone(null); setPhone(""); setName(""); setNames([]); setSeats([]); setCount(1); setNotes(""); setFareOverride(""); setPay("UNPAID"); setAmount(""); setTxn(""); setDups([]);
    loadTrip(tripId);
  }

  const tripOpts = useMemo(() => tripsRes?.data ?? [], [tripsRes]);
  if (done) return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="card p-6 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="mt-2 text-xl font-extrabold">Booking created</h1>
        <div className="mt-1 font-mono text-3xl font-extrabold tracking-wider text-brand-700">{done.reference}</div>
        <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-700">{done.text}</pre>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <a className="btn-primary" target="_blank" rel="noopener" href={`https://wa.me/91${phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(done.text)}`}>💬 Send on WhatsApp</a>
          <button className="btn-outline" onClick={() => navigator.clipboard.writeText(done.text)}>Copy message</button>
          <Link className="btn-outline" href={`/admin/bookings/${done.id}`}>Open booking</Link>
        </div>
      </div>
      <button className="btn-accent w-full py-3" onClick={reset}>+ Another booking on same trip</button>
    </div>
  );

  return (
    <form onSubmit={(e) => submit(e)} className="space-y-5">
      <div><h1 className="text-2xl font-extrabold">New booking</h1><p className="text-sm text-slate-500">For WhatsApp, phone or counter requests. Keyboard-friendly: Tab through fields, Enter to save.</p></div>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="card p-4">
            <h2 className="font-bold">1. Trip</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {[0, 1, 2].map((i) => { const d = addDays(todayLocal(), i); return <button type="button" key={d} onClick={() => { setDate(d); setTripId(""); }} className={`rounded-full px-3 py-1 text-xs font-semibold ${date === d ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}>{["Today", "Tomorrow", "Day after"][i]}</button>; })}
              <input type="date" className="input h-8 w-auto py-1 text-xs" value={date} onChange={(e) => { setDate(e.target.value); setTripId(""); }} aria-label="Travel date" />
            </div>
            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
              {tl && <Spinner className="h-5 w-5 text-brand-600" />}
              {!tl && !tripOpts.length && <p className="text-sm text-slate-500">No open trips on this date.</p>}
              {tripOpts.map((t) => (
                <label key={t.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm ${tripId === t.id ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-brand-200"}`}>
                  <input type="radio" name="trip" className="accent-brand-600" checked={tripId === t.id} onChange={() => setTripId(t.id)} />
                  <span className="w-20 font-bold tabular-nums">{fmtTime(t.departAt)}</span>
                  <span className="flex-1">{t.route.name}<span className="text-xs text-slate-500"> · {t.bus.name}</span></span>
                  <span className="hidden sm:block"><OccupancyBar booked={t.booked} capacity={t.capacity} /></span>
                  <span className="font-semibold">{formatINR(t.fare)}</span>
                </label>
              ))}
            </div>
          </section>

          {trip && (
            <section className="card p-4">
              <h2 className="font-bold">2. Customer & seats <span className="text-xs font-normal text-slate-500">· {trip.available} left</span></h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="ph">Mobile *</label><input id="ph" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus placeholder="10-digit mobile" /></div>
                <div><label className="label" htmlFor="nm">Customer name *</label><input id="nm" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              </div>
              {dups.length > 0 && <div className="mt-3"><Alert tone="warn">⚠ This number already has {dups.map((d) => <Link key={d.id} className="font-mono font-bold underline" href={`/admin/bookings/${d.id}`}>{d.reference}</Link>)} on this trip.</Alert></div>}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><label className="label">Boarding</label><select className="input" value={board} onChange={(e) => setBoard(e.target.value)}>{trip.stops.filter((s) => s.isBoarding).map((s) => <option key={s.id} value={s.id}>{fmtTime(s.time)} · {s.name}</option>)}</select></div>
                <div><label className="label">Drop-off</label><select className="input" value={drop} onChange={(e) => setDrop(e.target.value)}>{trip.stops.filter((s) => s.isDropoff && s.sequence > boardSeq).map((s) => <option key={s.id} value={s.id}>{fmtTime(s.time)} · {s.name}</option>)}</select></div>
              </div>
              <div className="mt-4 flex flex-wrap items-start gap-5">
                {hasSeats ? (
                  <SeatMap capacity={trip.capacity} layout={trip.bus.seatLayout!} taken={trip.takenSeats} selected={seats} max={trip.available}
                    onToggle={(s) => setSeats((x) => x.includes(s) ? x.filter((y) => y !== s) : [...x, s].sort((a, b) => +a - +b))} />
                ) : null}
                <div className="space-y-2">
                  {!hasSeats || seats.length === 0 ? (
                    <div><label className="label">Passengers</label>
                      <div className="flex items-center gap-2">
                        <button type="button" className="btn-outline h-9 w-9 p-0" onClick={() => setCount((c) => Math.max(1, c - 1))}>−</button>
                        <span className="w-8 text-center text-xl font-bold">{count}</span>
                        <button type="button" className="btn-outline h-9 w-9 p-0" onClick={() => setCount((c) => Math.min(trip.available, c + 1))}>+</button>
                      </div>
                      {hasSeats && <p className="mt-1 text-xs text-slate-500">Seats auto-assigned unless you pick them.</p>}
                    </div>
                  ) : <p className="text-sm font-semibold">Seats: {seats.join(", ")}</p>}
                  {n > 1 && <div className="space-y-1.5"><div className="label">Other passenger names (optional)</div>
                    {Array.from({ length: n - 1 }, (_, i) => <input key={i} className="input py-1.5" placeholder={`${name || "Guest"} (guest ${i + 2})`} value={names[i + 1] ?? ""} onChange={(e) => setNames((a) => { const c = [...a]; c[i + 1] = e.target.value; return c; })} />)}
                  </div>}
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="h-fit space-y-4 xl:sticky xl:top-6">
          <section className="card space-y-3 p-4">
            <h2 className="font-bold">3. Source & payment</h2>
            <div className="grid grid-cols-4 gap-1">{["WHATSAPP", "PHONE", "COUNTER", "ONLINE"].map((s) => <button type="button" key={s} onClick={() => setSource(s)} className={`rounded-md border px-1 py-1.5 text-[11px] font-semibold ${source === s ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200"}`}>{s === "WHATSAPP" ? "WhatsApp" : s[0] + s.slice(1).toLowerCase()}</button>)}</div>
            <div className="grid grid-cols-2 gap-1">{([["UNPAID", "Not paid"], ["FULL", "Paid full"], ["PARTIAL", "Part paid"], ["POST_TRAVEL", "Pay after travel"]] as const).map(([k, l]) => <button type="button" key={k} onClick={() => setPay(k)} className={`rounded-md border px-2 py-1.5 text-xs font-semibold ${pay === k ? "border-brand-600 bg-brand-50 text-brand-900" : "border-slate-200"}`}>{l}</button>)}</div>
            {(pay === "FULL" || pay === "PARTIAL") && (
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method">{["UPI", "CASH", "BANK", "OTHER"].map((m) => <option key={m}>{m}</option>)}</select>
                {pay === "PARTIAL" ? <input className="input" placeholder="Amount ₹" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /> : <input className="input" disabled value={formatINR(total)} />}
                {method !== "CASH" && <input className="input col-span-2" placeholder="UPI / txn reference (optional)" value={txn} onChange={(e) => setTxn(e.target.value)} />}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Fare / seat</label><input className="input" inputMode="decimal" placeholder={trip ? fromPaise(trip.fare) : ""} value={fareOverride} onChange={(e) => setFareOverride(e.target.value)} /></div>
              <div><label className="label">Notes</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            </div>
            <div className="flex items-center justify-between border-t pt-3"><span className="text-sm text-slate-500">{n} × {formatINR(fare)}</span><span className="text-xl font-extrabold text-brand-700">{formatINR(total)}</span></div>
            {err && <Alert>{err}</Alert>}
            <button className="btn-primary w-full py-3" disabled={busy || !trip}>{busy ? <Spinner /> : "Save booking"}</button>
          </section>
        </aside>
      </div>
    </form>
  );
}
