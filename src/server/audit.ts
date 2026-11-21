import { db, schema, type Tx } from "@/db";
import type { Actor } from "@/lib/auth";

export async function audit(tx: Tx | typeof db, actor: Actor | null, action: string, entity: string, entityId: string, changes?: unknown) {
  await tx.insert(schema.auditLogs).values({
    actorId: actor?.id ?? null, actorName: actor?.name ?? "Passenger (online)", action, entity, entityId,
    changes: changes === undefined ? null : (changes as object),
  });
}
