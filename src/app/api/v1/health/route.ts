import { sql } from "drizzle-orm";
import { db } from "@/db";
import { handle } from "@/lib/api";
export const dynamic = "force-dynamic";
export const GET = handle(async () => { await db.execute(sql`select 1`); return { status: "ok", time: new Date().toISOString() }; });
