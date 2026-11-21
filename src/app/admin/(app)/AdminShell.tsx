"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, createContext, useContext } from "react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/client";
import type { Actor } from "@/lib/auth";

const ActorCtx = createContext<Actor | null>(null);
export const useActor = () => useContext(ActorCtx)!;

const NAV: { href: string; label: string; icon: string; roles: Actor["role"][] }[] = [
  { href: "/admin", label: "Dashboard", icon: "📊", roles: ["ADMIN", "STAFF"] },
  { href: "/admin/bookings/new", label: "New booking", icon: "➕", roles: ["ADMIN", "STAFF"] },
  { href: "/admin/bookings", label: "Bookings", icon: "🎫", roles: ["ADMIN", "STAFF", "TRIP_STAFF"] },
  { href: "/admin/trips", label: "Trips & manifests", icon: "🚌", roles: ["ADMIN", "STAFF", "TRIP_STAFF"] },
  { href: "/admin/reports", label: "Reports", icon: "📈", roles: ["ADMIN", "STAFF"] },
  { href: "/admin/buses", label: "Buses", icon: "🚍", roles: ["ADMIN"] },
  { href: "/admin/routes", label: "Routes & stops", icon: "🗺️", roles: ["ADMIN"] },
  { href: "/admin/staff", label: "Staff", icon: "👥", roles: ["ADMIN"] },
];

export function AdminShell({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => n.roles.includes(actor.role));
  const active = (h: string) => h === "/admin" ? path === "/admin" : h === "/admin/bookings" ? path.startsWith("/admin/bookings") && !path.startsWith("/admin/bookings/new") : path.startsWith(h);
  async function logout() { await api("/auth/logout", { method: "POST" }).catch(() => {}); router.replace("/admin/login"); router.refresh(); }

  const nav = (
    <nav className="space-y-0.5 p-3">
      {items.map((n) => (
        <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active(n.href) ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-brand-50 hover:text-brand-900"}`}>
          <span aria-hidden>{n.icon}</span>{n.label}
        </Link>
      ))}
    </nav>
  );
  return (
    <ActorCtx.Provider value={actor}>
      <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
        <aside className="no-print sticky top-0 hidden h-screen flex-col border-r bg-white lg:flex">
          <div className="flex h-16 items-center border-b px-5"><Link href="/admin"><Logo className="h-8" /></Link></div>
          <div className="flex-1 overflow-y-auto">{nav}</div>
          <div className="border-t p-4 text-sm">
            <div className="font-semibold text-slate-900">{actor.name}</div>
            <div className="text-xs text-slate-500">{actor.role.replace("_", " ").toLowerCase()}</div>
            <div className="mt-2 flex gap-2"><Link href="/" className="btn-outline btn-sm" target="_blank">Site ↗</Link><button onClick={logout} className="btn-ghost btn-sm">Log out</button></div>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white px-4 lg:hidden">
            <button onClick={() => setOpen(!open)} className="btn-ghost btn-sm text-lg" aria-label="Menu">☰</button>
            <Logo className="h-7" />
            <Link href="/admin/bookings/new" className="btn-primary btn-sm">+ Book</Link>
          </header>
          {open && <div className="no-print border-b bg-white lg:hidden">{nav}<div className="flex items-center justify-between border-t px-4 py-3 text-sm"><span>{actor.name}</span><button onClick={logout} className="btn-ghost btn-sm">Log out</button></div></div>}
          <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ActorCtx.Provider>
  );
}
