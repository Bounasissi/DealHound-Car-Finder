import { jsonError, jsonOk, withApi } from "@/lib/api";
import { HistoryProviderUnavailableError, historyProvider } from "@/sources/history";
import { evaluateAndStore } from "@/lib/evaluate";
import { addHistoryCheck, getListing, patchListing } from "@/lib/repo";
import { deriveTitleState } from "@/domain/title";

type Ctx = { params: Promise<{ id: string }> };

/** Run a title/history check via the configured provider and re-evaluate. */
export const POST = withApi<Ctx>("listings.historyCheck", async (_req, { params }) => {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) throw new Error("Listing not found");
  if (!listing.vin) throw new Error("VIN required before history check — request it from the seller");

  let check;
  try {
    check = await historyProvider.check(listing.vin);
  } catch (error) {
    if (error instanceof HistoryProviderUnavailableError) {
      return jsonError(503, error.message, { code: error.code, retryable: true });
    }
    throw error;
  }
  await addHistoryCheck(id, check);

  // History is authoritative over seller claims for the stored title state.
  const newState = deriveTitleState(listing.titleClaims, check);
  await patchListing(id, { titleState: newState });

  const evaluation = await evaluateAndStore(id);
  return jsonOk({ historyCheck: check, evaluation: evaluation.evaluation });
});
