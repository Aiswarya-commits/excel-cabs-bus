// Database connection.
//  • DATABASE_URL set  → real PostgreSQL (recommended for production)
//  • DATABASE_URL empty → built-in embedded PostgreSQL (PGlite) stored in ./.data/
//    Zero setup: tables are created and demo data loaded automatically on first run.
import path from "node:path";
import fs from "node:fs";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema";

type DB = NodePgDatabase<typeof schema>;
const MIGRATIONS = path.join(process.cwd(), "drizzle");
export const usingEmbeddedDb = !process.env.DATABASE_URL;

const g = globalThis as unknown as { __db?: DB; __pool?: Pool; __pglite?: { close(): Promise<void> }; __ready?: Promise<void> };

function create(): DB {
  if (g.__db) return g.__db;
  if (!usingEmbeddedDb) {
    g.__pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    g.__db = drizzlePg(g.__pool, { schema });
  } else {
    // Loaded lazily so production builds with DATABASE_URL never touch PGlite
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require("@electric-sql/pglite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/pglite");
    const dir = path.join(process.cwd(), ".data", "db");
    fs.mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    g.__pglite = client;
    g.__db = drizzle(client, { schema }) as DB; // same query API
  }
  return g.__db!;
}

// Opened lazily on first use, so importing this file (e.g. during `next build`) never opens the database.
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    const real = create() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});
/** Runs migrations (and, for the embedded DB, loads demo data the first time). */
export function ensureReady(opts: { seedIfEmpty?: boolean } = { seedIfEmpty: true }): Promise<void> {
  if (g.__ready) return g.__ready;
  g.__ready = (async () => {
    if (usingEmbeddedDb) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { migrate } = require("drizzle-orm/pglite/migrator");
      await migrate(db, { migrationsFolder: MIGRATIONS });
      if (opts.seedIfEmpty) {
        const r = await db.execute<{ n: number }>(sql`select count(*)::int as n from users`);
        if (!r.rows[0] || Number(r.rows[0].n) === 0) {
          console.log("[db] Empty built-in database — loading demo data…");
          const { seed } = await import("./seed");
          await seed(db);
        }
      }
    } else {
      await migratePg(db, { migrationsFolder: MIGRATIONS });
    }
  })();
  return g.__ready;
}

export async function closeDb() {
  await g.__pool?.end();
  await g.__pglite?.close();
}

export type { DB };
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
