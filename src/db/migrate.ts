// npm run db:migrate — applies SQL migrations in ./drizzle
import "dotenv/config";
async function main() {
  const { ensureReady, closeDb } = await import("./index");
  await ensureReady({ seedIfEmpty: false });
  await closeDb();
  console.log("✔ migrations applied");
}
main().catch((e) => { console.error(e); process.exit(1); });
