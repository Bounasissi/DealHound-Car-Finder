import { jsonOk, withApi } from "@/lib/api";
import { csvImportInput } from "@/lib/schemas";
import { buildManualListing, parseCsvListings } from "@/sources";
import { normalizeListing } from "@/domain/normalize";
import { evaluateAndStore } from "@/lib/evaluate";
import { upsertListing } from "@/lib/repo";

/** Import only user-provided CSV data; no remote source is contacted. */
export const POST = withApi("listings.csvImport", async (req) => {
  const { csv } = csvImportInput.parse(await req.json());
  const inputs = parseCsvListings(csv);
  const imported = [];
  for (const input of inputs) {
    const normalized = normalizeListing({
      ...buildManualListing({ ...input, sourceId: "csv-manual-import", sourceKind: "manual-ingestion" }),
    });
    const result = await upsertListing(normalized);
    const evaluation = await evaluateAndStore(result.listing.id!);
    imported.push({ listing: result.listing, created: result.created, evaluation: evaluation.evaluation });
  }
  return jsonOk({ imported }, { status: 201 });
});

/** Import an allowlisted JSON/plain-text feed only when explicitly configured. */
export const runtime = "nodejs";
