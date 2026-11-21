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
const DATA_DIR = path.join(process.cwd(), ".data", "db");
export const usingEmbeddedDb = !process.env.DATABASE_URL;

const g = globalThis as unknown as { __db?: DB; __pool?: Pool; __pglite?: { close(): Promise<void> }; __ready?: Promise<void>; __memory?: boolean };

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
    let client;
    if (g.__memory) client = new PGlite(); // in-memory fallback (data resets on restart)
    else { fs.mkdirSync(DATA_DIR, { recursive: true }); client = new PGlite(DATA_DIR); }
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
      const setup = async () => {
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
      };
      const reset = async () => { try { await g.__pglite?.close(); } catch {} g.__pglite = undefined; g.__db = undefined; };
      try {
        await setup();
      } catch (e) {
        // Usually a damaged .data folder (e.g. two servers used it at once). Move it aside and start fresh.
        console.warn("[db] Built-in database could not open — creating a fresh one.", (e as Error).message);
        await reset();
        try {
          if (fs.existsSync(DATA_DIR)) fs.renameSync(DATA_DIR, `${DATA_DIR}-broken-${Date.now()}`);
          await setup();
        } catch (e2) {
          console.warn("[db] Using an in-memory database for this session (data resets on restart).", (e2 as Error).message);
          await reset(); g.__memory = true;
          await setup();
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