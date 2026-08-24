import { jsonError, jsonOk, withApi } from "@/lib/api";
import { manualIngestInput } from "@/lib/schemas";
import { buildManualListing } from "@/sources";
import { normalizeListing } from "@/domain/normalize";
import { evaluateAndStore } from "@/lib/evaluate";
import { addValuation, getProfile, listListings, upsertListing } from "@/lib/repo";
import { currentUserId } from "@/lib/auth";
import { consumePersistentUsage, UsageLimitError } from "@/lib/usage";

export const GET = withApi("listings.list", async (req) => {
  const url = new URL(req.url);
  const watchedParam = url.searchParams.get("watched");
  const stage = url.searchParams.get("stage") ?? undefined;
  const profileId = url.searchParams.get("profileId");
  const profile = profileId ? await getProfile(profileId) : undefined;
  if (profileId && !profile) return jsonError(404, "Profile not found");
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "100");
  const sortParam = url.searchParams.get("sort") ?? "recent";
  if (sortParam !== "recent" && sortParam !== "price" && sortParam !== "score") {
    return jsonError(400, "sort must be recent, price, or score");
  }
  const listings = await listListings({
    watched: watchedParam === null ? undefined : watchedParam === "true",
    stage,
    profile: profile ?? undefined,
    page,
    pageSize,
    sort: sortParam,
  });
  return jsonOk({ listings });
});

/**
 * Ingest a listing from user-assisted Facebook Marketplace content
 * (pasted text / screenshot notes / URL). No scraping — the user supplies data.
 * Normalizes, dedups, and runs the full evaluation pipeline.
 */
export const POST = withApi("listings.ingest", async (req) => {
  const body = manualIngestInput.parse(await req.json());
  const usage = await consumePersistentUsage(currentUserId(), "listingImports");
  if (!usage.allowed) throw new UsageLimitError("listingImports", usage.count, usage.limit);
  const raw = buildManualListing(body);
  const normalized = normalizeListing(raw);
  const { listing, created, mergedFields } = await upsertListing(normalized);
  if (body.kbbGoodValue !== undefined) {
    await addValuation(listing.id!, {
      provider: "manual-kbb-entry",
      referenceGoodValue: body.kbbGoodValue,
      compMedian: null,
      compRange: null,
      confidence: 0.85,
      notes: "User-entered KBB Good-condition value at import.",
      computedAt: new Date().toISOString(),
    });
  }
  const result = await evaluateAndStore(listing.id!);
  return jsonOk(
    {
      listing,
      dedup: { created, mergedFields },
      evaluation: result.evaluation,
      alertCreated: result.alertCreated,
    },
    { status: created ? 201 : 200 },
  );
});
