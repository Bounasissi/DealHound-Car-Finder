import { desc, eq } from "drizzle-orm";
import { jsonError, jsonOk, withApi } from "@/lib/api";
import { currentUserRole } from "@/lib/auth";
import { db } from "@/db";
import { jobs, usageCounters } from "@/db/schema";

export const GET = withApi("admin.health", async () => {
  if (currentUserRole() !== "OWNER") return jsonError(403, "Owner access required");
  const failedJobs = await db.select({ id: jobs.id, ownerId: jobs.ownerId, kind: jobs.kind, attempts: jobs.attempts, lastError: jobs.lastError, updatedAt: jobs.updatedAt }).from(jobs).where(eq(jobs.state, "FAILED")).orderBy(desc(jobs.updatedAt)).limit(50);
  const usage = await db.select().from(usageCounters).orderBy(desc(usageCounters.updatedAt)).limit(100);
  return jsonOk({ failedJobs, usage });
});
