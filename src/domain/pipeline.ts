/**
 * Evaluation pipeline orchestrator.
 * Pure-ish: async only where VIN decode is injected. Deterministic given inputs,
 * so scoring decisions are auditable and replayable.
 */
import { loadConfig, type AppConfig } from "./config";
import { assessFraud } from "./fraud";
import { computeDealEconomics } from "./economics";
import { computePredictionError } from "./learning";
import { buildIssues, parseIssuesFromText, summarizeRepairs } from "./repairs";
import { computeDealScore, DEAL_SCORE_FORMULA_VERSION } from "./scoring";
import {
  deriveTitleState,
  evaluateHardRejects,
  satisfiesCleanTitleRequirement,
} from "./title";
import type {
  DealEvaluation,
  DealEvaluationInput,
  HistoryCheck,
  PurchaseOutcome,
  WorkflowStage,
} from "./types";
import { TITLE_STATE_RANK } from "./types";
import { buildValuationBundle } from "./valuation";
import { detectMismatches, vinConfidenceFor } from "./vin";

export interface PipelineDeps {
  config?: AppConfig;
}

export function evaluateListing(input: DealEvaluationInput, deps: PipelineDeps = {}): DealEvaluation {
  const config = deps.config ?? loadConfig();
  const { listing, profile } = input;

  // --- VIN decode reconciliation -------------------------------------------
  let vinDecode = input.vinDecode;
  if (vinDecode && vinDecode.valid) {
    const mismatches = detectMismatches(vinDecode.attributes, listing.vehicle);
    vinDecode = { ...vinDecode, mismatches };
    vinDecode.matchConfidence =
      mismatches.length === 0 ? Math.max(0.9, vinDecode.matchConfidence) : Math.min(0.4, vinDecode.matchConfidence);
  }
  const vinConfidence = vinConfidenceFor(listing.vin, vinDecode);

  // --- Title state ------------------------------------------------------------
  const historyCheck: HistoryCheck | null = input.historyCheck;
  const titleState = historyCheck?.titleState ?? deriveTitleState(listing.titleClaims, null);

  // --- Hard rejects -------------------------------------------------------------
  const hardReject = evaluateHardRejects(
    historyCheck,
    listing.titleClaims,
    vinConfidence === "DECODED_MISMATCH",
  );
  const hardRejectReasons = [...hardReject.reasons];

  // Clean-title requirement failure is a profile-level reject reason (not brand hard-reject).
  const cleanTitleOk = satisfiesCleanTitleRequirement(titleState, profile.requireCleanTitle);

  // --- Repairs ---------------------------------------------------------------------
  const fullText = `${listing.title ?? ""}\n${listing.description ?? ""}\n${listing.rawText ?? ""}`;
  const parsedRefs = [...parseIssuesFromText(fullText)];
  // Merge refs already stored on the normalized listing (from ingestion-time parse).
  for (const ref of listing.parsedIssues) {
    if (!parsedRefs.some((r) => r.category === ref.category)) parsedRefs.push(ref);
  }
  const issues = buildIssues({ parsedRefs, userIssues: input.userIssues, vehicle: listing.vehicle, fullText });
  const repairs = summarizeRepairs(issues, { rejectedCategories: profile.rejectedRepairCategories });

  // --- Valuation ----------------------------------------------------------------------
  const valuation = buildValuationBundle(input.valuations, listing.price);
  const economics = computeDealEconomics({
    askingPrice: listing.price ?? 0,
    valuation,
    repairs,
    config,
  });

  // --- Fraud ------------------------------------------------------------------------------
  const fraud = assessFraud({
    listing,
    valuation,
    vinMismatch: vinConfidence === "DECODED_MISMATCH",
    duplicateCount: 0, // set by caller when duplicates known; pipeline-level default
    config,
  });

  // --- Score ---------------------------------------------------------------------------------
  const score = computeDealScore({
    economics,
    repairs,
    titleState,
    requireCleanTitle: profile.requireCleanTitle,
    vinConfidence,
    fraud,
    profile,
    liquidity: input.liquidityHint ?? { comparableCount: 0 },
    distanceMiles: null,
    hasSellerContact: Boolean(listing.sellerContact),
  });

  if (!cleanTitleOk) {
    score.rejectionReasons.unshift(
      `Profile requires clean title; current state ${titleState} is insufficient`,
    );
  }

  const hardRejected = hardReject.rejected || !cleanTitleOk;

  // --- Suggested workflow stage -----------------------------------------------------------------
  const suggestedStage = suggestStageFor(titleState, listing.vin, Boolean(historyCheck));

  return {
    listingId: listing.id ?? "",
    evaluatedAt: new Date().toISOString(),
    formulaVersion: DEAL_SCORE_FORMULA_VERSION,
    vinDecode,
    titleState,
    hardRejected,
    hardRejectReasons,
    valuation,
    repairs,
    economics,
    fraud,
    score,
    suggestedStage,
    qualifiesForAlert: false, // set by alerts layer after evaluation
  };
}

function suggestStageFor(titleState: string, vin: string | null, hasHistoryCheck: boolean): WorkflowStage {
  if (!vin) return "VIN_REQUESTED";
  if (!hasHistoryCheck) return "VIN_VERIFIED";
  if (TITLE_STATE_RANK[titleState as keyof typeof TITLE_STATE_RANK] < TITLE_STATE_RANK.DOCUMENT_REVIEWED)
    return "TITLE_CHECKED";
  return "QUESTIONS";
}

/** Convenience: prediction error for a purchase outcome against an evaluation. */
export function predictionErrorFor(evaluation: DealEvaluation, actual: PurchaseOutcome) {
  return computePredictionError(evaluation, actual);
}
