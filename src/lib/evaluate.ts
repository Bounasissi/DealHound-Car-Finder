/**
 * Evaluation service: loads all evidence for a listing, runs the pipeline,
 * persists the evaluation (auditable payload), and records alerts for
 * qualifying deals.
 */
import { loadConfig } from "@/domain/config";
import { buildAlertPayload, evaluateAlertRule } from "@/domain/alerts";
import { evaluateListing } from "@/domain/pipeline";
import { deriveTitleState } from "@/domain/title";
import { configuredLicensedKbbProvider, configuredMarketCheckPriceProvider } from "@/domain/valuation";
import type { DealEvaluation, SearchProfile } from "@/domain/types";
import { historyProvider } from "@/sources/history";
import { decodeVin } from "@/domain/vin";
import { log } from "./logger";
import { deliverAlert, deliverEmailAlert } from "./notifications";
import { shouldDeliverNotification } from "@/domain/notifications";
import { getNotificationPreferences } from "./notification-preferences";
import { consumePersistentUsage, UsageLimitError } from "./usage";
import { currentUserId } from "./auth";
import {
  addHistoryCheck,
  countDuplicates,
  addValuation,
  getCachedVin,
  getListing,
  latestHistoryCheck,
  listProfiles,
  listUserIssues,
  listValuations,
  patchListing,
  saveAlert,
  recordNotificationDelivery,
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

  const evaluationUsage = await consumePersistentUsage(currentUserId(), "evaluations");
  if (!evaluationUsage.allowed) throw new UsageLimitError("evaluations", evaluationUsage.count, evaluationUsage.limit);

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

  let historyCheck = await latestHistoryCheck(listingId);
  if (!historyCheck && listing.vin && historyProvider.isConfigured()) {
    try {
      const titleUsage = await consumePersistentUsage(currentUserId(), "titleChecks");
      if (!titleUsage.allowed) throw new UsageLimitError("titleChecks", titleUsage.count, titleUsage.limit);
      historyCheck = await historyProvider.check(listing.vin);
      await addHistoryCheck(listingId, historyCheck);
      await patchListing(listingId, { titleState: deriveTitleState(listing.titleClaims, historyCheck) });
    } catch (error) {
      if (error instanceof UsageLimitError) throw error;
      log.warn("history.provider_unavailable", {
        listingId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let valuationResults = await listValuations(listingId);
  if (valuationResults.length === 0) {
    const providers = [configuredLicensedKbbProvider(), configuredMarketCheckPriceProvider()].filter((provider) => provider.isConfigured());
    for (const provider of providers) {
      try {
        const valuationUsage = await consumePersistentUsage(currentUserId(), "valuationCalls");
        if (!valuationUsage.allowed) throw new UsageLimitError("valuationCalls", valuationUsage.count, valuationUsage.limit);
        const automaticValuation = await provider.getReferenceValue({ listing });
        if (automaticValuation) {
          await addValuation(listingId, automaticValuation);
          valuationResults = [automaticValuation];
        }
      } catch (error) {
        if (error instanceof UsageLimitError) throw error;
        log.warn("valuation.provider_unavailable", {
          listingId,
          provider: provider.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      if (valuationResults.length > 0) break;
    }
  }

  const [userIssues, duplicateCount] = await Promise.all([
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
    duplicateCount,
  });

  // Alert rule — only qualifying deals alert.
  const decision = evaluateAlertRule(evaluation, profileResolved, {
    minScore: config.alertMinScore,
    maxAskingRatio: config.alertMaxAskingRatio,
    minTitleRank: config.alertMinTitleRank,
    minExpectedMargin: profileResolved.minDealMargin,
    requireNoMajorMechanicalRisk: config.alertRequireNoMajorMechanicalRisk,
  });
  // Persist the same qualification decision that controls alert creation so
  // historical snapshots cannot disagree with the alert pipeline.
  evaluation.qualifiesForAlert = decision.qualifies;
  const evaluationId = await saveEvaluation(listingId, profileResolved.id ?? null, evaluation);

  let alertCreated = false;
  if (decision.qualifies) {
    const headline = `${[listing.vehicle.year, listing.vehicle.make, listing.vehicle.model].filter(Boolean).join(" ")} — $${listing.price?.toLocaleString() ?? "?"}`;
    const alert = await saveAlert(listingId, evaluationId, buildAlertPayload(listingId, headline, evaluation, null));
    alertCreated = alert.created;
    if (alert.created && alert.id) {
      const preferences = await getNotificationPreferences();
      const shouldDeliver = shouldDeliverNotification({ score: evaluation.score.total, margin: evaluation.economics?.expectedMargin ?? 0, hour: new Date().getHours() }, preferences);
      if (shouldDeliver) {
        const payload = buildAlertPayload(listingId, headline, evaluation, null);
        const delivery = await deliverAlert(payload);
        await updateAlertDelivery(alert.id, delivery);
        await recordNotificationDelivery(alert.id, "webhook", delivery);
        if (preferences.email) {
          const emailDelivery = await deliverEmailAlert({ to: preferences.email, subject: `DealHound alert: ${headline}`, text: JSON.stringify(payload, null, 2) });
          await recordNotificationDelivery(alert.id, "email", emailDelivery);
        }
      } else {
        const skipped = { status: "SKIPPED", attempts: 0, error: "Notification preference threshold, mode, or quiet hours suppressed outbound delivery" };
        await updateAlertDelivery(alert.id, skipped);
        await recordNotificationDelivery(alert.id, "outbound", skipped);
      }
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
