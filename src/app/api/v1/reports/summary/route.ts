import { handle } from "@/lib/api";
import { requireRole, BOOKING_STAFF } from "@/lib/auth";
import { todayLocal } from "@/lib/time";
import { summary, trend } from "@/server/reports";

export const dynamic = "force-dynamic";
// GET /reports/summary?from=&to=  (travel dates, default today)
export const GET = handle(async (req) => {
  await requireRole(...BOOKING_STAFF);
  const s = new URL(req.url).searchParams;
  const from = s.get("from") || todayLocal(); const to = s.get("to") || from;
  const [sum, tr] = await Promise.all([summary(from, to), trend(7, todayLocal())]);
  return { data: { ...sum, trend: tr } };
});
