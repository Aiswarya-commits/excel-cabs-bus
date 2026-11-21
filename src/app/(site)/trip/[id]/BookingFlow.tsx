"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SeatMap } from "@/components/SeatMap";
import { Alert, Spinner } from "@/components/ui";
import { api, ClientError } from "@/lib/client";
import { formatINR } from "@/lib/money";
import { fmtTime } from "@/lib/time";
import { brand } from "@/lib/brand";

type Stop = { id: string; name: string; landmark: string | null; sequence: number; isBoarding: boolean; isDropoff: boolean; time: string };
type Trip = {
  id: string; fare: number; capacity: number; available: number; takenSeats: string[]; bookable: boolean; status: string; notes: string | null;
  bus: { seatLayout: string | null; amenities: string[]; name: string; type: string }; stops: Stop[];
};
type Pax = { name: string; age: string; gender: "" | "M" | "F" | "O" };
const blank = (): Pax => ({ name: "", age: "", gender: "" });

export function BookingFlow({ trip: initial, initialBoard, initialDrop }: { trip: Trip; initialBoard?: string; initialDrop?: string }) {
  const router = useRouter();
  const [trip, setTrip] = useState(initial);
  const hasSeats = !!trip.bus.seatLayout;
  const boardOpts = trip.stops.filter((s) => s.isBoarding);
  const [board, setBoard] = useState(initialBoard && boardOpts.some((s) => s.id === initialBoard) ? initialBoard : boardOpts[0]?.id);
  const boardSeq = trip.stops.find((s) => s.id === board)?.sequence ?? 0;
  const dropOpts = trip.stops.filter((s) => s.isDropoff && s.sequence > boardSeq);
  const [drop, setDrop] = useState(initialDrop && trip.stops.some((s) => s.id === initialDrop) ? initialDrop : trip.stops[trip.stops.length - 1]?.id);
  const dropValid = dropOpts.some((s) => s.id === drop) ? drop : dropOpts[dropOpts.length - 1]?.id;

  const max = Math.min(brand.maxPassengersPerBooking, trip.available);
  const [seats, setSeats] = useState<string[]>([]);
  const [count, setCount] = useState(1);
  const n = hasSeats ? seats.length : count;
  const [pax, setPax] = useState<Pax[]>([blank()]);
  const paxList = useMemo(() => Array.from({ length: n }, (_, i) => pax[i] ?? blank()), [n, pax]);
  const [phone, setPhone] = useState(""); const [email, setEmail] = useState(""); const [notes, setNotes] = useState(""); const [hp, setHp] = useState("");
  const [agree, setAgree] = useState(true);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");

  const toggleSeat = (s: string) => setSeats((x) => x.includes(s) ? x.filter((y) => y !== s) : [...x, s].sort((a, b) => +a - +b));
  const updPax = (i: number, p: Partial<Pax>) => setPax((all) => { const c = Array.from({ length: Math.max(all.length, n) }, (_, k) => all[k] ?? blank()); c[i] = { ...c[i], ...p }; return c; });

  async function refresh() {
    try { const r = await api<{ data: Trip }>(`/trips/${trip.id}`); setTrip(r.data); return r.data; } catch { return trip; }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (n < 1) return setErr(hasSeats ? "Please select at least one seat." : "Choose number of passengers.");
    if (paxList.some((p) => p.name.trim().length < 2)) return setErr("Please enter the name of every passenger.");
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").slice(-10))) return setErr("Please enter a valid 10-digit mobile number.");
    if (!agree) return setErr("Please accept the booking terms.");
    setBusy(true);
    try {
      const r = await api<{ data: { reference: string; ticketUrl: string } }>("/bookings", { method: "POST", json: {
        tripId: trip.id, contactName: paxList[0].name, contactPhone: phone, contactEmail: email || null, notes: notes || null,
        boardingStopId: board, dropStopId: dropValid, website: hp,
        passengers: paxList.map((p, i) => ({ name: p.name, age: p.age ? Number(p.age) : null, gender: p.gender || null, seatNumber: hasSeats ? seats[i] : null })),
      } });
      router.push(r.data.ticketUrl + "&new=1");
    } catch (ex) {
      const ce = ex as ClientError;
      if (ce.code === "SEAT_TAKEN" || ce.code === "CAPACITY") {
        const t = await refresh();
        setSeats((s) => s.filter((x) => !t.takenSeats.includes(x)));
      }
      setErr(ce.code === "DUPLICATE" ? `${ce.message} Check "My Booking" or contact us if you need more seats.` : ce.message);
      setBusy(false);
    }
  }

  if (!trip.bookable) return <Alert tone="warn">Online booking is closed for this trip ({trip.available === 0 ? "sold out" : "departing soon or not open"}). Call {brand.phone} for help.</Alert>;

  const total = trip.fare * n;
  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <section className="card p-5">
          <h2 className="font-bold">1. Boarding & drop-off</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="board">Boarding point</label>
              <select id="board" className="input" value={board} onChange={(e) => setBoard(e.target.value)}>
                {boardOpts.map((s) => <option key={s.id} value={s.id}>{fmtTime(s.time)} · {s.name}{s.landmark ? ` (${s.landmark})` : ""}</option>)}
              </select></div>
            <div><label className="label" htmlFor="drop">Drop-off point</label>
              <select id="drop" className="input" value={dropValid} onChange={(e) => setDrop(e.target.value)}>
                {dropOpts.map((s) => <option key={s.id} value={s.id}>{fmtTime(s.time)} · {s.name}{s.landmark ? ` (${s.landmark})` : ""}</option>)}
              </select></div>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">2. {hasSeats ? "Choose your seats" : "Number of passengers"}</h2>
            <span className="text-xs font-semibold text-emerald-700">{trip.available} available</span>
          </div>
          {hasSeats ? (
            <div className="mt-4 flex flex-wrap items-start gap-6">
              <SeatMap capacity={trip.capacity} layout={trip.bus.seatLayout!} taken={trip.takenSeats} selected={seats} onToggle={toggleSeat} max={max} />
              <div className="text-sm text-slate-600">
                <p>Tap seats to select (max {max}).</p>
                {seats.length > 0 && <p className="mt-2 font-semibold text-slate-900">Selected: {seats.join(", ")}</p>}
                <button type="button" onClick={refresh} className="btn-ghost btn-sm mt-2 px-0 text-brand-700">↻ Refresh availability</button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3">
              <button type="button" className="btn-outline h-10 w-10 p-0 text-lg" onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="Fewer passengers">−</button>
              <span className="w-10 text-center text-2xl font-extrabold tabular-nums" aria-live="polite">{count}</span>
              <button type="button" className="btn-outline h-10 w-10 p-0 text-lg" onClick={() => setCount((c) => Math.min(max, c + 1))} aria-label="More passengers">+</button>
              <span className="text-sm text-slate-500">Seats are allotted on boarding.</span>
            </div>
          )}
        </section>

        {n > 0 && (
          <section className="card p-5">
            <h2 className="font-bold">3. Passenger details</h2>
            <div className="mt-3 space-y-3">
              {paxList.map((p, i) => (
                <div key={i} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[90px_1fr_90px_120px] sm:items-center">
                  <div className="text-xs font-bold text-brand-700">{hasSeats ? `Seat ${seats[i]}` : `Passenger ${i + 1}`}</div>
                  <input className="input" placeholder="Full name" value={p.name} onChange={(e) => updPax(i, { name: e.target.value })} aria-label={`Passenger ${i + 1} name`} required />
                  <input className="input" placeholder="Age" inputMode="numeric" maxLength={3} value={p.age} onChange={(e) => updPax(i, { age: e.target.value.replace(/\D/g, "") })} aria-label={`Passenger ${i + 1} age`} />
                  <select className="input" value={p.gender} onChange={(e) => updPax(i, { gender: e.target.value as Pax["gender"] })} aria-label={`Passenger ${i + 1} gender`}>
                    <option value="">Gender</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="phone">Mobile number *</label>
                <div className="flex"><span className="inline-flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">+91</span>
                <input id="phone" className="input rounded-l-none" inputMode="tel" placeholder="10-digit mobile" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
                <p className="mt-1 text-xs text-slate-500">Ticket details are sent / shared on this number.</p></div>
              <div><label className="label" htmlFor="email">Email (optional)</label><input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="notes">Note for the operator (optional)</label><input id="notes" className="input" maxLength={300} placeholder="e.g. travelling with luggage, senior citizen" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <input tabIndex={-1} autoComplete="off" className="hidden" aria-hidden value={hp} onChange={(e) => setHp(e.target.value)} name="website" />
            </div>
          </section>
        )}
      </div>

      <aside className="h-fit space-y-3 lg:sticky lg:top-20">
        <div className="card p-5">
          <h2 className="font-bold">Fare summary</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Fare per seat</dt><dd>{formatINR(trip.fare)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Passengers</dt><dd>{n}</dd></div>
            {hasSeats && n > 0 && <div className="flex justify-between"><dt className="text-slate-500">Seats</dt><dd className="font-semibold">{seats.join(", ")}</dd></div>}
            <div className="flex justify-between border-t pt-2 text-base font-extrabold"><dt>Total</dt><dd className="text-brand-700">{formatINR(total)}</dd></div>
          </dl>
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">💳 No online payment needed now. Pay by UPI or cash at boarding — staff will update your payment.</div>
          <label className="mt-3 flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I agree to the cancellation policy and to share my details with {brand.name} for this trip.</label>
          {err && <div className="mt-3"><Alert>{err}</Alert></div>}
          <button disabled={busy || n === 0} className="btn-primary mt-4 w-full py-3 text-base">{busy ? <><Spinner /> Booking…</> : `Book ${n || ""} seat${n === 1 ? "" : "s"}`}</button>
        </div>
        {trip.bus.amenities.length > 0 && <div className="card p-4 text-xs text-slate-600"><span className="font-semibold text-slate-800">Amenities: </span>{trip.bus.amenities.join(" · ")}</div>}
        {trip.notes && <Alert tone="info">{trip.notes}</Alert>}
      </aside>
    </form>
  );
}
