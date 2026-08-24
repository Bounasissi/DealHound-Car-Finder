import { describe, expect, it } from "vitest";
import { buildAlertPayload, evaluateAlertRule } from "@/domain/alerts";
import { evaluateListing } from "@/domain/pipeline";
import { evalInput, normalizedListing } from "./fixtures";
import type { DealEvaluationInput, SearchProfile } from "@/domain/types";

const rule = {
  minScore: 85,
  maxAskingRatio: 0.7,
  minTitleRank: 2,
  minExpectedMargin: 2000,
  requireNoMajorMechanicalRisk: true,
};

function profileWith(overrides: Partial<SearchProfile> = {}): SearchProfile {
  return { ...evalInput().profile, ...overrides };
}

/** Strong deal: ratio 0.48, no repairs, clean history → should clear every condition. */
function strongDealInput(): DealEvaluationInput {
  const listing = normalizedListing({
    price: 7200,
    title: "2016 Toyota Camry LE",
    description: "Well maintained, garage kept, new tires and brakes, selling because we moved.",
    rawText: undefined,
  });
  return evalInput({ listing, valuations: [{ provider: "manual-kbb-entry", referenceGoodValue: 15000, compMedian: null, compRange: null, confidence: 0.9, notes: "", computedAt: "2026-08-22T12:00:00.000Z" }] });
}

describe("evaluateAlertRule", () => {
  it("strong qualifying deal passes all conditions", () => {
    const evaluation = evaluateListing(strongDealInput());
    const decision = evaluateAlertRule(evaluation, profileWith(), rule);
    expect(decision.failedConditions).toEqual([]);
    expect(decision.qualifies).toBe(true);
    expect(evaluation.score.total).toBeGreaterThanOrEqual(85);
  });

  it("fails on low score when overpriced", () => {
    const input = strongDealInput();
    input.listing.price = 13000; // ratio .87 → weak discount
    const evaluation = evaluateListing(input);
    const decision = evaluateAlertRule(evaluation, profileWith(), rule);
    expect(decision.qualifies).toBe(false);
    expect(decision.failedConditions.some((c) => c.startsWith("score"))).toBe(true);
  });

  it("fails when title confidence insufficient", () => {
    const input = strongDealInput();
    input.historyCheck = null;
    const evaluation = evaluateListing(input);
    const decision = evaluateAlertRule(evaluation, profileWith(), rule);
    expect(decision.failedConditions.some((c) => c.includes("title state"))).toBe(true);
  });

  it("fails on major mechanical risk", () => {
    const input = strongDealInput();
    input.userIssues = [{
      id: "x", category: "ENGINE_MAJOR", description: "engine knock",
      severity: "HIGH", confidence: 0.9, estimateLow: 3000, estimateExpected: 5200,
      estimateHigh: 9000, majorRisk: true, source: "USER_INPUT",
    }];
    const evaluation = evaluateListing(input);
    const decision = evaluateAlertRule(evaluation, profileWith(), rule);
    expect(decision.failedConditions.some((c) => c.includes("major mechanical"))).toBe(true);
  });

  it("respects custom rule thresholds (stricter margin)", () => {
    const evaluation = evaluateListing(strongDealInput());
    const decision = evaluateAlertRule(evaluation, profileWith(), { ...rule, minExpectedMargin: 999999 });
    expect(decision.qualifies).toBe(false);
    expect(decision.failedConditions.some((c) => c.includes("margin"))).toBe(true);
  });

  it("never alerts when Gate B fails even if score and margin look strong", () => {
    const evaluation = evaluateListing(strongDealInput());
    evaluation.economics!.bothGatesPassed = false;
    evaluation.economics!.gateB = { passed: false, detail: "all-in ratio too high" };
    const decision = evaluateAlertRule(evaluation, profileWith(), {
      minScore: 0,
      maxAskingRatio: 0.7,
      minTitleRank: 2,
      minExpectedMargin: 0,
      requireNoMajorMechanicalRisk: false,
    });
    expect(decision.qualifies).toBe(false);
    expect(decision.failedConditions).toContain("both economics gates did not pass");
  });

  it("never alerts when profile repair or fraud caps reject the evaluation", () => {
    const repairInput = strongDealInput();
    const repairEvaluation = evaluateListing({
      ...repairInput,
      profile: profileWith({ maxExpectedRepairs: 1 }),
    });
    expect(repairEvaluation.score.rejectionReasons.some((reason) => reason.includes("exceed max"))).toBe(true);
    expect(evaluateAlertRule(repairEvaluation, profileWith({ maxExpectedRepairs: 1 }), rule).qualifies).toBe(false);

    const fraudInput = strongDealInput();
    fraudInput.listing.description = `${fraudInput.listing.description ?? ""} Send a deposit to hold it and pay by Zelle.`;
    const fraudEvaluation = evaluateListing({
      ...fraudInput,
      profile: profileWith({ maxFraudRiskScore: 0 }),
    });
    expect(fraudEvaluation.score.rejectionReasons.some((reason) => reason.includes("Fraud risk"))).toBe(true);
    expect(evaluateAlertRule(fraudEvaluation, profileWith({ maxFraudRiskScore: 0 }), rule).qualifies).toBe(false);
  });
});

describe("buildAlertPayload", () => {
  it("includes every required field", () => {
    const evaluation = evaluateListing(evalInput());
    const payload = buildAlertPayload("listing-1", "2016 Toyota Camry LE — $9,500", evaluation, 27);
    expect(payload).toMatchObject({
      listingId: "listing-1",
      headline: "2016 Toyota Camry LE — $9,500",
      price: 9500,
      referenceValue: 15000,
      expectedRepairs: evaluation.repairs.totalExpected,
      allInBasis: evaluation.economics!.expectedAllInBasis,
      expectedMargin: evaluation.economics!.expectedMargin,
      titleConfidence: "HISTORY_CLEAN",
      distanceMiles: 27,
      score: evaluation.score.total,
      scoreClass: evaluation.score.scoreClass,
    });
    expect(payload.createdAt).toBeTruthy();
  });
});
