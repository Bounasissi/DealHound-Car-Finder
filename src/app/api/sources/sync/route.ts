import { jsonError, jsonOk, withApi } from "@/lib/api";
import { getProfile, upsertListing } from "@/lib/repo";
import { evaluateAndStore } from "@/lib/evaluate";
import { normalizeListing } from "@/domain/normalize";
import { sourceRegistry } from "@/sources";

export const POST = withApi("sources.sync", async (req) => {
  const body = (await req.json()) as { profileId?: string; sourceId?: string };
  if (!body.profileId) return jsonError(422, "profileId is required");
  const profile = await getProfile(body.profileId);
  if (!profile) return jsonError(404, "Profile not found");
  const sources = body.sourceId ? [sourceRegistry.get(body.sourceId)] : sourceRegistry.configured();
  const source = sources.find((candidate) => candidate && candidate.id !== "facebook-marketplace-manual");
  if (!source) return jsonError(503, "No configured listing source", { retryable: true });
  let rawListings;
  try {
    rawListings = await source.fetchListings(profile);
  } catch (error) {
    return jsonError(503, error instanceof Error ? error.message : "Listing source failed", { retryable: true, source: source.id });
  }
  const results = [];
  for (const raw of rawListings) {
    const normalized = normalizeListing(raw);
    const stored = await upsertListing(normalized);
    const evaluation = await evaluateAndStore(stored.listing.id!, profile);
    results.push({ listing: stored.listing, created: stored.created, evaluation: evaluation.evaluation });
  }
  return jsonOk({ source: source.id, count: results.length, results });
});
