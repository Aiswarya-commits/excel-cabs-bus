import { z } from "zod";
import { handle, jsonBody } from "@/lib/api";
import { requireRole, ALL_STAFF } from "@/lib/auth";
import { setBoarding } from "@/server/bookings";

type P = { id: string };
const s = z.object({ status: z.enum(["NOT_CHECKED", "BOARDED", "NO_SHOW"]) });
export const PATCH = handle<P>(async (req, { params }) => {
  const actor = await requireRole(...ALL_STAFF);
  return setBoarding((await params).id, s.parse(await jsonBody(req)).status, actor);
});
