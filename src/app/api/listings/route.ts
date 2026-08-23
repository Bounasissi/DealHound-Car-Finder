import { jsonError, jsonOk, withApi } from "@/lib/api";
import { manualIngestInput } from "@/lib/schemas";
import { buildManualListing } from "@/sources";
import { normalizeListing } from "@/domain/normalize";
import { evaluateAndStore } from "@/lib/evaluate";
import { listListings, upsertListing } from "@/lib/repo";

export const GET = withApi("listings.list", async (req) => {
  const url = new URL(req.url);
  const watchedParam = url.searchParams.get("watched");
  const stage = url.searchParams.get("stage") ?? undefined;
  const listings = await listListings({
    watched: watchedParam === null ? undefined : watchedParam === "true",
    stage,
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
  const raw = buildManualListing(body);
  const normalized = normalizeListing(raw);
  const { listing, created, mergedFields } = await upsertListing(normalized);
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
