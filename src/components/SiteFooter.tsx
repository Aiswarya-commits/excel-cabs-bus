import Link from "next/link";
import { brand } from "@/lib/brand";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="no-print mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <Logo className="h-8" />
          <p className="mt-3 text-sm text-slate-500">{brand.tagline} Safe, punctual local bus travel.</p>
        </div>
        <div className="text-sm">
          <div className="font-semibold text-slate-900">Contact</div>
          <ul className="mt-2 space-y-1 text-slate-600">
            <li>📞 <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="hover:text-brand-700">{brand.phone}</a></li>
            <li>💬 <a href={`https://wa.me/${brand.whatsapp}`} className="hover:text-brand-700">WhatsApp</a></li>
            <li>✉️ <a href={`mailto:${brand.email}`} className="hover:text-brand-700">{brand.email}</a></li>
            <li>🕘 {brand.supportHours}</li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="font-semibold text-slate-900">Quick links</div>
          <ul className="mt-2 space-y-1 text-slate-600">
            <li><Link href="/manage" className="hover:text-brand-700">Find my ticket</Link></li>
            <li><Link href="/#help" className="hover:text-brand-700">Cancellation policy</Link></li>
            <li><a href={brand.website} className="hover:text-brand-700">Excel Cabs — taxis & cabs</a></li>
            <li><Link href="/admin" className="hover:text-brand-700">Staff login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-slate-400">© {new Date().getFullYear()} {brand.name}. All rights reserved.</div>
    </footer>
  );
}
