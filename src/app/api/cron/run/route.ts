import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { searchProfiles } from "@/db/schema";
import { runWithAuth } from "@/lib/auth";
import { claimNextJob, completeJob, enqueueJob, failClaimedJob } from "@/lib/jobs";
import { syncProfile } from "@/lib/source-sync";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workerId = `cron-${crypto.randomUUID()}`;
  const slot = Math.floor(Date.now() / 300_000);
  const activeProfiles = await db.select({ id: searchProfiles.id, ownerId: searchProfiles.ownerId }).from(searchProfiles).where(eq(searchProfiles.active, true));
  for (const profile of activeProfiles) {
    await enqueueJob(profile.ownerId, "SOURCE_SYNC", { profileId: profile.id }, `scheduled-sync:${profile.id}:${slot}`);
  }

  const results: Array<{ id: string; state: string; error?: string }> = [];
  for (let i = 0; i < 25; i += 1) {
    const job = await claimNextJob(workerId);
    if (!job) break;
    try {
      if (job.kind !== "SOURCE_SYNC" || typeof job.payload !== "object" || !job.payload || !("profileId" in job.payload)) throw new Error(`Unsupported job ${job.kind}`);
      await runWithAuth({ userId: job.ownerId, role: "USER" }, async () => {
        await syncProfile(String((job.payload as { profileId: string }).profileId), (job.payload as { sourceId?: string }).sourceId);
      });
      await completeJob(job.id, workerId);
      results.push({ id: job.id, state: "SUCCEEDED" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failClaimedJob(job.id, workerId, job.attempts, job.maxAttempts, message);
      results.push({ id: job.id, state: job.attempts >= job.maxAttempts ? "FAILED" : "RETRY", error: message });
    }
  }
  return NextResponse.json({ scheduled: activeProfiles.length, processed: results.length, results });
}
