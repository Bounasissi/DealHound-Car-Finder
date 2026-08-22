/**
 * Alert qualification. Alerts fire ONLY on configurable qualifying deals:
 *   score >= min AND asking_ratio <= max AND title confidence sufficient
 *   AND expected_margin >= minimum AND no major mechanical risk (configurable)
 */
import type { AlertPayload, DealEvaluation, SearchProfile } from "./types";

export interface AlertDecision {
  qualifies: boolean;
  failedConditions: string[];
}

export function evaluateAlertRule(
  evaluation: DealEvaluation,
  profile: SearchProfile,
  rule: { minScore: number; maxAskingRatio: number; minTitleRank: number; minExpectedMargin: number; requireNoMajorMechanicalRisk: boolean },
): AlertDecision {
  const failed: string[] = [];
  const { score, economics, repairs, titleState } = evaluation;

  if (score.total < rule.minScore) failed.push(`score ${score.total} < ${rule.minScore}`);
  if (!economics || economics.askingRatio === null) {
    failed.push("no valuation/asking ratio");
  } else if (economics.askingRatio > rule.maxAskingRatio) {
    failed.push(`asking ratio ${economics.askingRatio} > ${rule.maxAskingRatio}`);
  }
  if (TITLE_STATE_RANK[titleState] < rule.minTitleRank) {
    failed.push(`title state ${titleState} below required rank ${rule.minTitleRank}`);
  }
  if (!economics || economics.expectedMargin < rule.minExpectedMargin) {
    failed.push(`expected margin below $${rule.minExpectedMargin.toLocaleString()}`);
  }
  if (rule.requireNoMajorMechanicalRisk && repairs.hasMajorRisk) {
    failed.push("major mechanical risk present");
  }

  return { qualifies: failed.length === 0, failedConditions: failed };
}

export function buildAlertPayload(
  listingId: string,
  headline: string,
  evaluation: DealEvaluation,
  distanceMiles: number | null,
): AlertPayload {
  const econ = evaluation.economics;
  return {
    listingId,
    headline,
    price: econ?.askingPrice ?? null,
    referenceValue: evaluation.valuation.referenceGoodValue,
    discountPct: evaluation.valuation.discountPct,
    expectedRepairs: evaluation.repairs.totalExpected,
    allInBasis: econ?.expectedAllInBasis ?? 0,
    expectedMargin: econ?.expectedMargin ?? 0,
    titleConfidence: evaluation.titleState,
    distanceMiles,
    score: evaluation.score.total,
    scoreClass: evaluation.score.scoreClass,
    createdAt: new Date().toISOString(),
  };
}
