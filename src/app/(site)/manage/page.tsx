"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Spinner } from "@/components/ui";
import { brand } from "@/lib/brand";

export default function ManagePage() {
  const router = useRouter();
  const [ref, setRef] = useState(""); const [phone, setPhone] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const r = await api<{ data: { ticketUrl: string } }>(`/bookings/lookup?ref=${encodeURIComponent(ref)}&phone=${encodeURIComponent(phone)}`);
      router.push(r.data.ticketUrl);
    } catch (ex) { setErr((ex as Error).message); setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-extrabold">Find my booking</h1>
      <p className="mt-1 text-sm text-slate-500">Enter your booking reference and the mobile number used while booking.</p>
      <form onSubmit={go} className="card mt-5 space-y-4 p-5">
        <div><label className="label" htmlFor="ref">Booking reference</label><input id="ref" className="input font-mono uppercase" placeholder="EXAB12CD" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} required /></div>
        <div><label className="label" htmlFor="ph">Mobile number</label><input id="ph" className="input" inputMode="tel" placeholder="10-digit mobile" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
        {err && <Alert>{err}</Alert>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : "View ticket"}</button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">Need to cancel or change? <a className="font-semibold text-brand-700" href={`https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(`Hi, I want to change/cancel my bus booking ${ref}`)}`}>WhatsApp us</a> or call {brand.phone}.</p>
    </div>
  );
}
