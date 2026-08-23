import type { Config } from "drizzle-kit";

const envUrl = process.env.DATABASE_URL;

export default {
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: envUrl
    ? { url: envUrl }
    : {
        // Local dev default: repo-local cluster (scripts/db-setup.sh).
        socketPath: `${process.cwd()}/.pgsock/.s.PGSQL.5433`,
        user: "dealhound",
        database: "dealhound",
      },
} satisfies Config;
