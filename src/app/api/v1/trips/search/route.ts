import { z } from "zod";
import { handle, clientIp } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { dateStr } from "@/lib/validation";
import { searchTrips } from "@/server/trips";

const q = z.object({ from: z.string().trim().min(2), to: z.string().trim().min(2), date: dateStr });
export const GET = handle(async (req) => {
  rateLimit(`search:${clientIp(req)}`, 120, 60_000);
  const u = new URL(req.url);
  const { from, to, date } = q.parse(Object.fromEntries(u.searchParams));
  return { data: await searchTrips(from, to, date) };
});
