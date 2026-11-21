// npm run db:seed — seeds the database in DATABASE_URL (or the built-in local DB if unset)
import "dotenv/config";
async function main() {
  const { db, ensureReady, closeDb } = await import("./index");
  await ensureReady({ seedIfEmpty: false });
  const { seed } = await import("./seed");
  await seed(db);
  await closeDb();
}
main().catch((e) => { console.error(e); process.exit(1); });
