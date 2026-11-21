import { handle } from "@/lib/api";
import { listPlaces } from "@/server/trips";
export const dynamic = "force-dynamic";
export const GET = handle(async () => ({ data: await listPlaces() }));
