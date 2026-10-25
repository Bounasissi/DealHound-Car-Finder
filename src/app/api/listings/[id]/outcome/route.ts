import { jsonError, jsonOk, withApi } from "@/lib/api";
import { computePredictionError } from "@/domain/learning";
import { loadConfig } from "@/domain/config";
import { outcomeInput } from "@/lib/schemas";
import { getListing, latestEvaluationRecord, recordOutcome } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Record a deal outcome. For purchases, computes prediction error
 * (predicted vs actual repairs/value/all-in/margin) for the learning loop.
 */
export const POST = withApi<Ctx>("listings.outcome", async (req, { params }) => {
  const { id } = await params;
  const body = outcomeInput.parse(await req.json());
  const listing = await getListing(id);
  if (!listing) return jsonError(404, "Listing not found");
  const evaluationRecord = await latestEvaluationRecord(id);
  const evaluation = evaluationRecord?.evaluation ?? null;
  const config = loadConfig();

  const actualAllIn = body.purchase && listing.price !== null
    ? body.purchase.actualAllIn ?? listing.price + body.purchase.actualRepairs + config.inspectionFee + config.transportationCost + Math.round(listing.price * config.taxTitleFeeRate) + config.immediateMaintenanceBase
    : null;
  const actualFinishedValue = body.purchase?.actualFinishedValue ?? body.purchase?.soldPrice ?? null;
  const actualMargin = body.purchase
    ? body.purchase.actualMargin ?? (actualFinishedValue !== null && actualAllIn !== null ? actualFinishedValue - actualAllIn : null)
    : null;

  let predictionError = null;
  if (body.outcome === "PURCHASED" && body.purchase && evaluation) {
    predictionError = computePredictionError(evaluation, {
      actualRepairs: body.purchase.actualRepairs,
      actualFinishedValue,
      actualAllIn,
      actualMargin,
      soldPrice: body.purchase.soldPrice ?? null,
    });
  }

  await recordOutcome({
    listingId: id,
    evaluationId: evaluationRecord?.id ?? null,
    outcome: body.outcome,
    notes: body.notes,
    purchase: body.purchase
      ? {
          actualRepairs: body.purchase.actualRepairs,
          actualFinishedValue,
          actualAllIn,
          actualMargin,
          soldPrice: body.purchase.soldPrice ?? null,
        }
      : undefined,
    predictionError: predictionError ?? undefined,
    recordedAt: new Date().toISOString(),
  });

  return jsonOk({ recorded: true, predictionError });
});
