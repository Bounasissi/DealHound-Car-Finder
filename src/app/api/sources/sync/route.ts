import { jsonError, jsonOk, withApi } from "@/lib/api";
import { currentUserId } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs";
import { getProfile } from "@/lib/repo";
import { syncProfile } from "@/lib/source-sync";

export const POST = withApi("sources.sync", async (req) => {
  const body = (await req.json()) as { profileId?: string; sourceId?: string; asynchronous?: boolean };
  if (!body.profileId) return jsonError(422, "profileId is required");
  const profile = await getProfile(body.profileId);
  if (!profile) return jsonError(404, "Profile not found");
  if (body.asynchronous) {
    const queued = await enqueueJob(currentUserId(), "SOURCE_SYNC", { profileId: profile.id, sourceId: body.sourceId }, `manual-sync:${profile.id}:${body.sourceId ?? "all"}:${Math.floor(Date.now() / 300_000)}`);
    return jsonOk({ queued: true, jobId: queued.id, created: queued.created }, { status: 202 });
  }
  try {
    return jsonOk(await syncProfile(profile.id!, body.sourceId));
  } catch (error) {
    return jsonError(503, error instanceof Error ? error.message : "Listing source failed", { retryable: true });
  }
});
