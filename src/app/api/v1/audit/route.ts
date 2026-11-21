import { and, desc, eq, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, pageParams } from "@/lib/api";
import { requireRole } from "@/lib/auth";

export const GET = handle(async (req) => {
  await requireRole("ADMIN");
  const url = new URL(req.url); const { pageSize, offset, page } = pageParams(url);
  const c: SQL[] = [];
  if (url.searchParams.get("entity")) c.push(eq(schema.auditLogs.entity, url.searchParams.get("entity")!));
  if (url.searchParams.get("entityId")) c.push(eq(schema.auditLogs.entityId, url.searchParams.get("entityId")!));
  const data = await db.select().from(schema.auditLogs).where(c.length ? and(...c) : undefined).orderBy(desc(schema.auditLogs.createdAt)).limit(pageSize).offset(offset);
  return { data, meta: { page, pageSize } };
});
