import { brand } from "@/lib/brand";
/* eslint-disable @next/next/no-img-element */
// Official Excel Cabs logo mark + wordmark in the logo colours.
export function Logo({ className = "h-9", wordmark = false }: { className?: string; wordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img src={brand.logo} alt={wordmark ? "" : brand.name} className={`${className} w-auto`} />
      {wordmark && (
        <span className="leading-none">
          <span className="block text-lg font-extrabold tracking-tight text-brand-600">Excel <span className="text-accent">Cabs</span></span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Bus Booking</span>
        </span>
      )}
    </span>
  );
}