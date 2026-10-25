import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { backoffUntil, failJob, type JobState } from "@/domain/jobs";

export interface JobRecord {
  id: string;
  ownerId: string;
  kind: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

export async function enqueueJob(ownerId: string, kind: string, payload: unknown, idempotencyKey: string, runAt = new Date()): Promise<{ created: boolean; id: string }> {
  const [row] = await db.insert(jobs).values({ ownerId, kind, payload, idempotencyKey, retryAt: runAt }).onConflictDoNothing({ target: [jobs.ownerId, jobs.idempotencyKey] }).returning({ id: jobs.id });
  if (row) return { created: true, id: row.id };
  const [existing] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.ownerId, ownerId), eq(jobs.idempotencyKey, idempotencyKey)));
  if (!existing) throw new Error("Job enqueue did not return or locate a job");
  return { created: false, id: existing.id };
}

export async function claimNextJob(workerId: string, lockSeconds = 120): Promise<JobRecord | null> {
  const now = new Date();
  const [candidate] = await db.select().from(jobs).where(and(
    or(eq(jobs.state, "QUEUED"), eq(jobs.state, "RETRY"), eq(jobs.state, "RUNNING")),
    or(isNull(jobs.retryAt), lte(jobs.retryAt, now)),
    or(isNull(jobs.lockedUntil), lte(jobs.lockedUntil, now)),
  )).orderBy(asc(jobs.createdAt)).limit(1);
  if (!candidate) return null;
  const [claimed] = await db.update(jobs).set({ state: "RUNNING", attempts: candidate.attempts + 1, lockedBy: workerId, lockedUntil: new Date(now.getTime() + lockSeconds * 1000), updatedAt: now }).where(and(eq(jobs.id, candidate.id), or(isNull(jobs.lockedUntil), lte(jobs.lockedUntil, now)))).returning();
  if (!claimed) return null;
  return { id: claimed.id, ownerId: claimed.ownerId, kind: claimed.kind, payload: claimed.payload, attempts: claimed.attempts, maxAttempts: claimed.maxAttempts };
}

export async function completeJob(id: string, workerId: string): Promise<void> {
  await db.update(jobs).set({ state: "SUCCEEDED", lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(jobs.id, id), eq(jobs.lockedBy, workerId), eq(jobs.state, "RUNNING")));
}

export async function failClaimedJob(id: string, workerId: string, attempts: number, maxAttempts: number, error: string): Promise<void> {
  const now = new Date();
  const next = failJob({ state: "RUNNING" as JobState, attempts }, error, now, maxAttempts);
  await db.update(jobs).set({ state: next.state, retryAt: next.retryAt, lastError: error.slice(0, 2000), lockedBy: null, lockedUntil: null, updatedAt: now }).where(and(eq(jobs.id, id), eq(jobs.lockedBy, workerId), eq(jobs.state, "RUNNING")));
}

export function nextRetryAt(attempts: number): Date {
  return backoffUntil(new Date(), attempts);
}
