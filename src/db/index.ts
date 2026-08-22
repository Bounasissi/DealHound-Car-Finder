import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url =
  process.env.DATABASE_URL ?? "postgres://dealhound@localhost:5433/dealhound?host=/Volumes/Bots/repos/DealHound-Car-Finder/.pgsock";

const client = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });

export const db = drizzle(client, { schema });
export { client };
export type Db = typeof db;
