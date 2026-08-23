import { jsonError, jsonOk, withApi } from "@/lib/api";
import { allowlistedUrlImportInput } from "@/lib/schemas";
import { buildManualListing, fetchAllowlistedListingUrl } from "@/sources";
import { normalizeListing } from "@/domain/normalize";
import { evaluateAndStore } from "@/lib/evaluate";
import { upsertListing } from "@/lib/repo";

export const runtime = "nodejs";

export const POST = withApi("listings.allowlistedUrlImport", async (req) => {
  const { url } = allowlistedUrlImportInput.parse(await req.json());
  try {
    const input = await fetchAllowlistedListingUrl(url);
    const normalized = normalizeListing(buildManualListing(input));
    const result = await upsertListing(normalized);
    const evaluation = await evaluateAndStore(result.listing.id!);
    return jsonOk({ listing: result.listing, dedup: result.created, evaluation: evaluation.evaluation }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return jsonError(400, error instanceof Error ? error.message : "Allowlisted URL import failed");
  }
});
