/**
 * Migration runner — applies SQL files in ./drizzle in order, tracking state
 * in a _migrations table. No external migration service required.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { client } from "../src/db";

async function main() {
  const dir = path.join(process.cwd(), "drizzle");
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    console.log("No ./drizzle directory; nothing to migrate.");
    return;
  }

  await client`CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  const applied = new Set(
    (await client`SELECT name FROM _migrations`).map((r) => r.name as string),
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(dir, file), "utf8");
    console.log(`Applying ${file} ...`);
    await client.unsafe(sql);
    await client`INSERT INTO _migrations (name) VALUES (${file})`;
  }
  console.log("Migrations complete.");
}

main()
  .then(() => client.end())
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
