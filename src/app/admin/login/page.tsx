"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Spinner } from "@/components/ui";
import { Logo } from "@/components/Logo";

function LoginForm() {
  const router = useRouter(); const sp = useSearchParams();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const r = await api<{ user: { role: string } }>("/auth/login", { method: "POST", json: { email, password } });
      const next = sp.get("next");
      router.replace(next && next.startsWith("/admin") ? next : r.user.role === "TRIP_STAFF" ? "/admin/trips" : "/admin");
      router.refresh();
    } catch (ex) { setErr((ex as Error).message); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
      <div className="flex justify-center"><Logo className="h-10" /></div>
      <div className="text-center"><h1 className="text-lg font-bold">Staff sign in</h1><p className="text-xs text-slate-500">Bus booking & management</p></div>
      <div><label className="label" htmlFor="em">Email</label><input id="em" type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
      <div><label className="label" htmlFor="pw">Password</label><input id="pw" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      {err && <Alert>{err}</Alert>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : "Sign in"}</button>
      <a href="/" className="block text-center text-xs text-slate-500 hover:text-brand-700">← Back to passenger site</a>
    </form>
  );
}
export default function LoginPage() {
  return <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-white p-4"><Suspense><LoginForm /></Suspense></div>;
}
