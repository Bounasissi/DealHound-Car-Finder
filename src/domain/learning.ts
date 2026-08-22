/**
 * Outcome recording & prediction-error learning.
 * Compares predicted vs actual repairs, finished value, all-in cost, and margin
 * so estimation error is measurable and future models can be recalibrated.
 */
import type { DealEvaluation, OutcomeType, PredictionErrorReport, PurchaseOutcome } from "./types";

export function computePredictionError(
  evaluation: DealEvaluation,
  actual: PurchaseOutcome,
): PredictionErrorReport {
  const predictedRepairs = evaluation.repairs.totalExpected;
  const repairsErrorAbs = actual.actualRepairs - predictedRepairs;
  const repairsErrorPct =
    predictedRepairs > 0 ? Math.round((repairsErrorAbs / predictedRepairs) * 1000) / 10 : null;

  const predictedFinished = evaluation.economics?.conservativeFinishedValue ?? null;
  const finishedValueErrorAbs =
    actual.actualFinishedValue !== null && predictedFinished !== null
      ? actual.actualFinishedValue - predictedFinished
      : null;

  const predictedAllIn = evaluation.economics?.expectedAllInBasis ?? null;
  const allInErrorAbs =
    actual.actualAllIn !== null && predictedAllIn !== null ? actual.actualAllIn - predictedAllIn : null;

  const predictedMargin = evaluation.economics?.expectedMargin ?? null;
  const marginErrorAbs =
    actual.actualMargin !== null && predictedMargin !== null ? actual.actualMargin - predictedMargin : null;

  const direction: PredictionErrorReport["direction"] =
    Math.abs(repairsErrorPct ?? 0) <= 10
      ? "ON_TARGET"
      : repairsErrorAbs > 0
        ? "UNDERESTIMATED_COST"
        : "OVERESTIMATED_COST";

  return {
    repairsErrorAbs,
    repairsErrorPct,
    finishedValueErrorAbs,
    allInErrorAbs,
    marginErrorAbs,
    direction,
  };
}

export interface OutcomeRecord {
  listingId: string;
  outcome: OutcomeType;
  notes?: string;
  purchase?: PurchaseOutcome;
  predictionError?: PredictionErrorReport;
  recordedAt: string;
}

/** Aggregate calibration stats across recorded purchase outcomes. */
export interface CalibrationStats {
  purchases: number;
  avgRepairsErrorPct: number | null;
  avgMarginErrorAbs: number | null;
  underestimates: number;
  overestimates: number;
  onTarget: number;
}

export function aggregateCalibration(records: OutcomeRecord[]): CalibrationStats {
  const purchases = records.filter((r) => r.outcome === "PURCHASED" && r.predictionError);
  const errs = purchases.map((r) => r.predictionError!.repairsErrorPct).filter((v): v is number => v !== null);
  const margins = purchases
    .map((r) => r.predictionError!.marginErrorAbs)
    .filter((v): v is number => v !== null);
  return {
    purchases: purchases.length,
    avgRepairsErrorPct:
      errs.length > 0 ? Math.round((errs.reduce((s, v) => s + v, 0) / errs.length) * 10) / 10 : null,
    avgMarginErrorAbs:
      margins.length > 0 ? Math.round(margins.reduce((s, v) => s + v, 0) / margins.length) : null,
    underestimates: purchases.filter((r) => r.predictionError!.direction === "UNDERESTIMATED_COST").length,
    overestimates: purchases.filter((r) => r.predictionError!.direction === "OVERESTIMATED_COST").length,
    onTarget: purchases.filter((r) => r.predictionError!.direction === "ON_TARGET").length,
  };
}
