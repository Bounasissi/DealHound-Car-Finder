import { sql } from "drizzle-orm";
import { db } from "@/db";
import { loadConfig } from "@/domain/config";
import { validateEnvironment } from "@/domain/environment";
import { assessReleaseReadiness } from "@/domain/health";

export async function GET() {
  const config = loadConfig();
  const configurationIssues = validateEnvironment(process.env as Record<string, string | undefined>);
  const providers = {
    database: "ok",
    vin: config.vpicBaseUrl ? "configured" : "unconfigured",
    valuation: config.valuationProviderUrl ? "configured" : "manual-or-comps",
    marketcheckPrice: config.marketCheckPriceEnabled && config.marketCheckApiKey ? "configured" : "disabled",
    history: config.historyProviderUrl ? "configured" : "manual-review",
    inventory: process.env.MARKETCHECK_API_KEY || process.env.INVENTORY_API_KEY ? "configured" : "manual-only",
    ai: process.env.AI_API_KEY ? "configured" : "text-only",
    email: process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY ? "configured" : "in-app-only",
    jobs: process.env.CRON_SECRET && process.env.CRON_SCHEDULE_VERIFIED_AT ? "configured" : "unconfigured",
    storage: process.env.OBJECT_STORAGE_BASE_URL ? "configured" : "local-development",
    backupRestore: process.env.BACKUP_RESTORE_VERIFIED_AT ? "configured" : "unconfigured",
    monitoring: process.env.MONITORING_VERIFIED_AT ? "configured" : "unconfigured",
  };
  const release = assessReleaseReadiness(providers);
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: configurationIssues.length ? "degraded" : "ok", database: "ok", configuration: { valid: configurationIssues.length === 0, issues: configurationIssues }, providers, release, at: new Date().toISOString() }, { status: configurationIssues.length ? 503 : 200 });
  } catch {
    return Response.json({ status: "degraded", database: "unavailable", configuration: { valid: configurationIssues.length === 0, issues: configurationIssues }, providers: { ...providers, database: "unavailable" }, release, at: new Date().toISOString() }, { status: 503 });
  }
}
