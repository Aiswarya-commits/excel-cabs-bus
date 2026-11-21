/** Seat numbering: 1..capacity. Layout "2+2" => 4 per row, "2+1" => 3 per row. */
export function seatLabels(capacity: number): string[] {
  return Array.from({ length: capacity }, (_, i) => String(i + 1));
}
export function seatRows(capacity: number, layout: string | null): (string | null)[][] {
  if (!layout) return [];
  const [l, r] = layout.split("+").map(Number);
  const per = l + r; const labels = seatLabels(capacity); const rows: (string | null)[][] = [];
  for (let i = 0; i < labels.length; i += per) {
    const chunk = labels.slice(i, i + per);
    rows.push([...chunk.slice(0, l), null, ...chunk.slice(l)]); // null = aisle
  }
  return rows;
}
