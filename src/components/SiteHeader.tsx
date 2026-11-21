import Link from "next/link";
import { Logo } from "./Logo";
import { brand } from "@/lib/brand";

export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" aria-label={`${brand.name} home`}><Logo className="h-9" /></Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link href="/manage" className="btn-ghost hidden sm:inline-flex">My Booking</Link>
          <Link href="/#help" className="btn-ghost hidden sm:inline-flex">Help</Link>
          <a href={`https://wa.me/${brand.whatsapp}`} target="_blank" rel="noopener" className="btn-ghost hidden md:inline-flex">WhatsApp us</a>
          <Link href="/manage" className="btn-outline btn-sm sm:hidden">My Booking</Link>
          <Link href="/admin" className="btn-primary btn-sm">Staff</Link>
        </nav>
      </div>
    </header>
  );
}
