// Money is stored as NUMERIC(10,2) in Postgres (string in JS) and handled as
// integer paise in code. No floating-point arithmetic on currency.
export function toPaise(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const s = typeof v === "number" ? v.toFixed(2) : String(v).trim();
  const m = /^(-)?(\d+)(?:\.(\d{0,2})\d*)?$/.exec(s);
  if (!m) throw new Error(`Invalid money value: ${v}`);
  const paise = parseInt(m[2], 10) * 100 + parseInt((m[3] ?? "").padEnd(2, "0") || "0", 10);
  return m[1] ? -paise : paise;
}
export function fromPaise(p: number): string {
  const neg = p < 0; const a = Math.abs(Math.trunc(p));
  return `${neg ? "-" : ""}${Math.floor(a / 100)}.${String(a % 100).padStart(2, "0")}`;
}
export function formatINR(p: number, opts: { decimals?: boolean } = {}): string {
  const rupees = Math.trunc(p / 100); const paise = Math.abs(p % 100);
  const s = new Intl.NumberFormat("en-IN").format(Math.abs(rupees));
  const dec = opts.decimals || paise ? `.${String(paise).padStart(2, "0")}` : "";
  return `${p < 0 ? "-" : ""}₹${s}${dec}`;
}
