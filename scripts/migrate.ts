/**
 * Migration runner — applies SQL files in ./drizzle in order, tracking state
 * in a _migrations table. No external migration service required.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

function connect(): postgres.Sql {
  if (process.env.DATABASE_URL) return postgres(process.env.DATABASE_URL);
  return postgres({
    host: `${process.cwd()}/.pgsock`,
    port: 5433,
    user: "dealhound",
    database: "dealhound",
  });
}

async function main() {
  const sql = connect();
  try {
    const dir = path.join(process.cwd(), "drizzle");
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    } catch {
      console.log("No ./drizzle directory; nothing to migrate.");
      return;
    }

    await sql`CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;
    const applied = new Set(
      (await sql`SELECT name FROM _migrations`).map((r) => r.name as string),
    );

    for (const file of files) {
      if (applied.has(file)) continue;
      const script = readFileSync(path.join(dir, file), "utf8");
      console.log(`Applying ${file} ...`);
      await sql.unsafe(script);
      await sql`INSERT INTO _migrations (name) VALUES (${file})`;
    }
    console.log("Migrations complete.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
