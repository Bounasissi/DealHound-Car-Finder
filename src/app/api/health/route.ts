import { sql } from "drizzle-orm";
import { db } from "@/db";
import { loadConfig } from "@/domain/config";

export async function GET() {
  const config = loadConfig();
  const providers = {
    database: "ok",
    vin: config.vpicBaseUrl ? "configured" : "unconfigured",
    valuation: config.valuationProviderUrl ? "configured" : "manual-or-comps",
    marketcheckPrice: config.marketCheckPriceEnabled && config.marketCheckApiKey ? "configured" : "disabled",
    history: config.historyProviderUrl ? "configured" : "manual-review",
    inventory: process.env.MARKETCHECK_API_KEY || process.env.INVENTORY_API_KEY ? "configured" : "manual-only",
    ai: process.env.AI_API_KEY ? "configured" : "text-only",
    email: process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY ? "configured" : "in-app-only",
    jobs: process.env.CRON_SECRET ? "configured" : "unconfigured",
    storage: process.env.OBJECT_STORAGE_BASE_URL ? "configured" : "local-development",
  };
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", database: "ok", providers, at: new Date().toISOString() });
  } catch {
    return Response.json({ status: "degraded", database: "unavailable", providers: { ...providers, database: "unavailable" }, at: new Date().toISOString() }, { status: 503 });
  }
}
