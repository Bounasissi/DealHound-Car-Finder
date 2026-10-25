import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function makeClient(): postgres.Sql {
  if (process.env.DATABASE_URL) {
    return postgres(process.env.DATABASE_URL, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  }
  // Local dev default: repo-local cluster created by scripts/db-setup.sh.
  return postgres({
    host: `${process.cwd()}/.pgsock`,
    port: 5433,
    user: "dealhound",
    database: "dealhound",
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export const db = drizzle(makeClient(), { schema });

