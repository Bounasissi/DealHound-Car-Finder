import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", database: "ok", at: new Date().toISOString() });
  } catch {
    return Response.json({ status: "degraded", database: "unavailable", at: new Date().toISOString() }, { status: 503 });
  }
}
