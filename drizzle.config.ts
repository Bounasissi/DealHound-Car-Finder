import type { Config } from "drizzle-kit";

const envUrl = process.env.DATABASE_URL;

export default {
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: envUrl
    ? { url: envUrl }
    : {
        host: `${process.cwd()}/.pgsock`,
        port: 5433,
        user: "dealhound",
        database: "dealhound",
      },
} satisfies Config;
