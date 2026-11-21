export const TZ = process.env.APP_TIMEZONE || process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata";

/** Offset in minutes of `tz` at instant `d` (e.g. +330 for IST). */
function tzOffsetMinutes(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUtc - d.getTime()) / 60000);
}
/** Convert local date "YYYY-MM-DD" + time "HH:mm" in operator TZ to a UTC Date. */
export function localToUtc(date: string, time: string, tz = TZ): Date {
  const naive = new Date(`${date}T${time}:00Z`);
  const off = tzOffsetMinutes(naive, tz);
  return new Date(naive.getTime() - off * 60000);
}
/** Today's date (YYYY-MM-DD) in operator TZ. */
export function todayLocal(tz = TZ, d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function fmtTime(d: Date | string, tz = TZ): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(d));
}
export function fmtTime24(d: Date | string, tz = TZ): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d));
}
export function fmtDate(d: Date | string, tz = TZ): string {
  const v = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00Z`) : new Date(d);
  return new Intl.DateTimeFormat("en-IN", { timeZone: typeof d === "string" && d.length === 10 ? "UTC" : tz, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(v);
}
export function fmtDateTime(d: Date | string, tz = TZ): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(d));
}
export function durationLabel(a: Date | string, b: Date | string): string {
  const m = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
