"use client";
import { seatRows } from "@/lib/seats";

export function SeatMap({ capacity, layout, taken, selected, onToggle, max }: {
  capacity: number; layout: string; taken: string[]; selected: string[]; onToggle: (s: string) => void; max: number;
}) {
  const rows = seatRows(capacity, layout); const t = new Set(taken); const sel = new Set(selected);
  return (
    <div className="inline-block rounded-2xl border-2 border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between border-b border-dashed pb-2 text-[10px] font-semibold uppercase text-slate-400">
        <span>Door</span><span className="flex items-center gap-1">Driver <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7M4 15l6-2M20 15l-6-2"/></svg></span>
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            {row.map((s, j) => s === null ? <div key={`a${j}`} className="w-5" /> : (
              <button type="button" key={s} disabled={t.has(s) || (!sel.has(s) && selected.length >= max)}
                onClick={() => onToggle(s)} aria-pressed={sel.has(s)} aria-label={`Seat ${s}${t.has(s) ? " (booked)" : ""}`}
                className={`seat ${t.has(s) ? "seat-taken" : sel.has(s) ? "seat-selected" : "seat-free"} disabled:opacity-100`}>{s}</button>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 border-t pt-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="seat seat-free h-4 w-4" />Available</span>
        <span className="flex items-center gap-1.5"><span className="seat seat-selected h-4 w-4" />Selected</span>
        <span className="flex items-center gap-1.5"><span className="seat seat-taken h-4 w-4" />Booked</span>
      </div>
    </div>
  );
}
