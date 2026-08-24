import { evaluateAndStore } from "@/lib/evaluate";
import { getProfile, upsertListing } from "@/lib/repo";
import { normalizeListing } from "@/domain/normalize";
import { sourceRegistry } from "@/sources";
import { currentUserId } from "./auth";
import { consumePersistentUsage, UsageLimitError } from "./usage";

export async function syncProfile(profileId: string, sourceId?: string) {
  const profile = await getProfile(profileId);
  if (!profile) throw new Error("Profile not found");
  const sources = sourceId ? [sourceRegistry.get(sourceId)] : sourceRegistry.configured();
  const source = sources.find((candidate) => candidate && candidate.id !== "facebook-marketplace-manual");
  if (!source) throw new Error("No configured listing source");
  const providerUsage = await consumePersistentUsage(currentUserId(), "providerCalls");
  if (!providerUsage.allowed) throw new UsageLimitError("providerCalls", providerUsage.count, providerUsage.limit);
  const rawListings = await source.fetchListings(profile);
  const results = [];
  for (const raw of rawListings) {
    const importUsage = await consumePersistentUsage(currentUserId(), "listingImports");
    if (!importUsage.allowed) throw new UsageLimitError("listingImports", importUsage.count, importUsage.limit);
    const stored = await upsertListing(normalizeListing(raw));
    const evaluation = await evaluateAndStore(stored.listing.id!, profile);
    results.push({ listing: stored.listing, created: stored.created, evaluation: evaluation.evaluation });
  }
  return { source: source.id, count: results.length, results };
}
