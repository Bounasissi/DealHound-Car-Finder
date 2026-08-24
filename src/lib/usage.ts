import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { usageCounters } from "@/db/schema";
import { defaultUsageLimits, type UsageLimits } from "@/domain/usage";

export type UsageMetric = keyof UsageLimits;

export class UsageLimitError extends Error {
  readonly status = 429;
  constructor(
    public readonly metric: UsageMetric,
    public readonly count: number,
    public readonly limit: number,
  ) {
    super(`Daily ${metric} limit reached (${limit})`);
    this.name = "UsageLimitError";
  }
}

export async function consumePersistentUsage(ownerId: string, metric: UsageMetric, amount = 1, limits = defaultUsageLimits()): Promise<{ allowed: boolean; count: number; limit: number }> {
  const limit = limits[metric];
  const day = new Date().toISOString().slice(0, 10);
  await db.insert(usageCounters).values({ ownerId, day, metric, count: 0 }).onConflictDoNothing({ target: [usageCounters.ownerId, usageCounters.day, usageCounters.metric] });
  const [row] = await db.update(usageCounters).set({ count: sql`${usageCounters.count} + ${amount}`, updatedAt: new Date() }).where(and(eq(usageCounters.ownerId, ownerId), eq(usageCounters.day, day), eq(usageCounters.metric, metric), sql`${usageCounters.count} + ${amount} <= ${limit}`)).returning({ count: usageCounters.count });
  if (row) return { allowed: true, count: row.count, limit };
  const [current] = await db.select({ count: usageCounters.count }).from(usageCounters).where(and(eq(usageCounters.ownerId, ownerId), eq(usageCounters.day, day), eq(usageCounters.metric, metric)));
  return { allowed: false, count: current?.count ?? 0, limit };
}

export { consumeUsage, defaultUsageLimits } from "@/domain/usage";
