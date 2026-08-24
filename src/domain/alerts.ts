/**
 * Alert qualification. Alerts fire ONLY on configurable qualifying deals:
 *   score >= min AND asking_ratio <= max AND title confidence sufficient
 *   AND expected_margin >= minimum AND no major mechanical risk (configurable)
 */
import { TITLE_STATE_RANK, type AlertPayload, type DealEvaluation, type SearchProfile } from "./types";
import { isAuthoritativeCleanTitle } from "./title";

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

  if (evaluation.hardRejected) failed.push("evaluation is hard-rejected");
  if (repairs.unknownCosts) failed.push("repair costs are unknown");
  if (score.rejectionReasons.length > 0) failed.push("profile or evaluation rejection applies");

  if (score.total < rule.minScore) failed.push(`score ${score.total} < ${rule.minScore}`);
  if (!economics || economics.askingRatio === null) {
    failed.push("no valuation/asking ratio");
  } else if (economics.askingRatio > rule.maxAskingRatio) {
    failed.push(`asking ratio ${economics.askingRatio} > ${rule.maxAskingRatio}`);
  }
  if (economics && !economics.bothGatesPassed) {
    failed.push("both economics gates did not pass");
  }
  if (rule.minTitleRank >= TITLE_STATE_RANK.HISTORY_CLEAN && !isAuthoritativeCleanTitle(titleState)) {
    failed.push(`title state ${titleState} is not authoritative history`);
  } else if (TITLE_STATE_RANK[titleState] < rule.minTitleRank) {
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
