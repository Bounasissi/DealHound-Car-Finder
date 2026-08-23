import { jsonOk, withApi } from "@/lib/api";
import { computePredictionError } from "@/domain/learning";
import { outcomeInput } from "@/lib/schemas";
import { latestEvaluation, recordOutcome } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Record a deal outcome. For purchases, computes prediction error
 * (predicted vs actual repairs/value/all-in/margin) for the learning loop.
 */
export const POST = withApi<Ctx>("listings.outcome", async (req, { params }) => {
  const { id } = await params;
  const body = outcomeInput.parse(await req.json());
  const evaluation = await latestEvaluation(id);

  let predictionError = null;
  if (body.outcome === "PURCHASED" && body.purchase && evaluation) {
    predictionError = computePredictionError(evaluation, {
      actualRepairs: body.purchase.actualRepairs,
      actualFinishedValue: body.purchase.actualFinishedValue ?? null,
      actualAllIn: body.purchase.actualAllIn ?? null,
      actualMargin: body.purchase.actualMargin ?? null,
      soldPrice: body.purchase.soldPrice ?? null,
    });
  }

  await recordOutcome({
    listingId: id,
    evaluationId: null,
    outcome: body.outcome,
    notes: body.notes,
    purchase: body.purchase
      ? {
          actualRepairs: body.purchase.actualRepairs,
          actualFinishedValue: body.purchase.actualFinishedValue ?? null,
          actualAllIn: body.purchase.actualAllIn ?? null,
          actualMargin: body.purchase.actualMargin ?? null,
          soldPrice: body.purchase.soldPrice ?? null,
        }
      : undefined,
    predictionError: predictionError ?? undefined,
    recordedAt: new Date().toISOString(),
  });

  return jsonOk({ recorded: true, predictionError });
});
