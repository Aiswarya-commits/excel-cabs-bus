// Runs once when the Next.js server starts: prepares the database.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureReady, usingEmbeddedDb } = await import("./db");
    await ensureReady();
    if (usingEmbeddedDb) console.log("[db] Using built-in local database (.data/db). Set DATABASE_URL to use PostgreSQL.");
  }
}
