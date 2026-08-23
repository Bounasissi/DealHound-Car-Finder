/**
 * Evaluation service: loads all evidence for a listing, runs the pipeline,
 * persists the evaluation (auditable payload), and records alerts for
 * qualifying deals.
 */
import { loadConfig } from "@/domain/config";
import { buildAlertPayload, evaluateAlertRule } from "@/domain/alerts";
import { evaluateListing } from "@/domain/pipeline";
import type { DealEvaluation, SearchProfile } from "@/domain/types";
import { decodeVin } from "@/domain/vin";
import { log } from "./logger";
import { deliverAlert } from "./notifications";
import {
  countDuplicates,
  getCachedVin,
  getListing,
  latestHistoryCheck,
  listProfiles,
  listUserIssues,
  listValuations,
  patchListing,
  saveAlert,
  updateAlertDelivery,
  saveEvaluation,
  setCachedVin,
} from "./repo";

export interface EvaluateResult {
  evaluation: DealEvaluation;
  evaluationId: string;
  alertCreated: boolean;
}

export async function evaluateAndStore(
  listingId: string,
  profile?: SearchProfile | null,
): Promise<EvaluateResult> {
  const listing = await getListing(listingId);
  if (!listing) throw new Error(`Listing ${listingId} not found`);
  const profileResolved = profile ?? (await getActiveProfile());
  if (!profileResolved) throw new Error("No active search profile available");

  const config = loadConfig();

  // VIN decode (cached in DB) — VIN is canonical identity.
  let vinDecode = null;
  if (listing.vin) {
    vinDecode = await decodeVin(listing.vin, {
      baseUrl: config.vpicBaseUrl,
      timeoutMs: config.vpicTimeoutMs,
      cacheGet: (v) => getCachedVin(v),
      cacheSet: setCachedVin,
    });
    if (listing.vinConfidence !== "DECODED_MATCH" && vinDecode.valid) {
      await patchListing(listingId, {
        vinConfidence: vinDecode.mismatches.length === 0 ? "DECODED_MATCH" : "DECODED_MISMATCH",
      });
    }
  }

  const [valuationResults, historyCheck, userIssues, duplicateCount] = await Promise.all([
    listValuations(listingId),
    latestHistoryCheck(listingId),
    listUserIssues(listingId),
    countDuplicates(listing.dedupKey, listingId),
  ]);

  const evaluation = evaluateListing({
    listing,
    profile: profileResolved,
    valuations: valuationResults,
    historyCheck,
    vinDecode,
    userIssues,
    transactionCosts: {
      taxTitleFeeRate: config.taxTitleFeeRate,
      inspectionFee: config.inspectionFee,
      transportationCost: config.transportationCost,
    },
    liquidityHint: { comparableCount: Math.min(10, valuationResults.length * 3 + duplicateCount) },
  });

  const evaluationId = await saveEvaluation(listingId, profileResolved.id ?? null, evaluation);

  // Alert rule — only qualifying deals alert.
  let alertCreated = false;
  const decision = evaluateAlertRule(evaluation, profileResolved, {
    minScore: config.alertMinScore,
    maxAskingRatio: config.alertMaxAskingRatio,
    minTitleRank: config.alertMinTitleRank,
    minExpectedMargin: profileResolved.minDealMargin,
    requireNoMajorMechanicalRisk: config.alertRequireNoMajorMechanicalRisk,
  });
  if (decision.qualifies) {
    const headline = `${[listing.vehicle.year, listing.vehicle.make, listing.vehicle.model].filter(Boolean).join(" ")} — $${listing.price?.toLocaleString() ?? "?"}`;
    const alert = await saveAlert(listingId, evaluationId, buildAlertPayload(listingId, headline, evaluation, null));
    alertCreated = alert.created;
    if (alert.created && alert.id) {
      const delivery = await deliverAlert(buildAlertPayload(listingId, headline, evaluation, null));
      await updateAlertDelivery(alert.id, delivery);
      log.info("alert.created", { listingId, score: evaluation.score.total });
    }
  }

  log.info("evaluation.stored", {
    listingId,
    evaluationId,
    score: evaluation.score.total,
    class: evaluation.score.scoreClass,
    hardRejected: evaluation.hardRejected,
  });

  return { evaluation, evaluationId, alertCreated };
}

export async function getActiveProfile(): Promise<SearchProfile | null> {
  const profiles = await listProfiles(true);
  return profiles[0] ?? null;
}
