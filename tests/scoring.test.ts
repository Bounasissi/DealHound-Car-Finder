import { describe, expect, it } from "vitest";
import { loadConfig } from "@/domain/config";
import { computeDealEconomics } from "@/domain/economics";
import { summarizeRepairs, estimateIssue } from "@/domain/repairs";
import { classifyScore, computeDealScore } from "@/domain/scoring";
import { buildValuationBundle } from "@/domain/valuation";
import { assessFraud } from "@/domain/fraud";
import { defaultProfile, manualValuation, normalizedListing } from "./fixtures";

function scoreFor(overrides: Parameters<typeof computeDealScore>[0] extends never ? never : Partial<Parameters<typeof computeDealScore>[0]> = {}) {
  const listing = overrides.repairs !== undefined ? normalizedListing() : normalizedListing();
  const valuation = buildValuationBundle([manualValuation(15000)], 8500);
  const repairs = overrides.repairs ?? summarizeRepairs([estimateIssue("OTHER_MAINTENANCE", "LOW")]);
  const economics = computeDealEconomics({ askingPrice: 8500, valuation, repairs, config: loadConfig() });
  const fraud = assessFraud({ listing, valuation, vinMismatch: false, duplicateCount: 0, config: loadConfig() });
  return computeDealScore({
    economics,
    repairs,
    titleState: "HISTORY_CLEAN",
    requireCleanTitle: true,
    vinConfidence: "DECODED_MATCH",
    fraud,
    profile: defaultProfile({ minDealMargin: 1500 }),
    liquidity: { comparableCount: 6 },
    distanceMiles: 20,
    hasSellerContact: true,
    ...overrides,
  });
}

describe("classifyScore", () => {
  it("maps ranges to classes", () => {
    expect(classifyScore(95)).toBe("EXCEPTIONAL");
    expect(classifyScore(85)).toBe("STRONG_BUY");
    expect(classifyScore(75)).toBe("INVESTIGATE");
    expect(classifyScore(55)).toBe("HIGH_RISK");
    expect(classifyScore(30)).toBe("REJECT");
    expect(classifyScore(90)).toBe("EXCEPTIONAL");
    expect(classifyScore(89.9)).toBe("STRONG_BUY");
  });
});

describe("computeDealScore", () => {
  it("produces all seven weighted factors summing to 100", () => {
    const s = scoreFor();
    expect(s.factors.map((f) => f.key).sort()).toEqual(
      ["discount", "logistics", "liquidity", "postRepairEconomics", "repairRisk", "sellerListingConfidence", "titleHistory"].sort(),
    );
    expect(s.factors.reduce((sum, f) => sum + f.weight, 0)).toBe(100);
    for (const f of s.factors) {
      expect(f.value).toBeGreaterThanOrEqual(0);
      expect(f.value).toBeLessThanOrEqual(100);
      expect(f.evidence.length).toBeGreaterThan(0);
    }
  });

  it("strong deal scores high with no rejection reasons", () => {
    const s = scoreFor();
    expect(s.total).toBeGreaterThan(70);
    expect(s.rejectionReasons).toHaveLength(0);
  });

  it("rejected repair categories produce rejection reasons", () => {
    const repairs = summarizeRepairs([estimateIssue("ENGINE_MAJOR", "MODERATE")], {
      rejectedCategories: ["ENGINE_MAJOR"],
    });
    const s = scoreFor({ repairs });
    expect(s.rejectionReasons.some((r) => r.includes("Rejected repair categories"))).toBe(true);
  });

  it("fraud risk above profile max is rejected", () => {
    const listing = normalizedListing({
      description: "send a deposit to hold it, I can ship the car anywhere, payment by zelle",
    });
    const valuation = buildValuationBundle([manualValuation(15000)], 9500);
    const fraud = assessFraud({ listing, valuation, vinMismatch: false, duplicateCount: 0, config: loadConfig() });
    const s = scoreFor({ fraud });
    expect(fraud.riskScore).toBeGreaterThan(defaultProfile().maxFraudRiskScore);
    expect(s.rejectionReasons.some((r) => r.includes("Fraud risk"))).toBe(true);
  });

  it("clean-title requirement failure is surfaced", () => {
    const s = scoreFor({ titleState: "SELLER_CLAIMS_CLEAN" });
    expect(s.rejectionReasons.some((r) => r.includes("Clean title required"))).toBe(true);
  });

  it("does not treat document review as authoritative clean history", () => {
    const s = scoreFor({ titleState: "DOCUMENT_REVIEWED" });
    expect(s.rejectionReasons.some((r) => r.includes("Clean title required"))).toBe(true);
    const titleFactor = s.factors.find((factor) => factor.key === "titleHistory");
    expect(titleFactor?.value).toBe(50);
  });

  it("expected repairs over profile cap are rejected", () => {
    const repairs = summarizeRepairs([
      estimateIssue("HVAC", "CRITICAL"),
      estimateIssue("SUSPENSION", "HIGH"),
      estimateIssue("COSMETIC", "HIGH"),
    ]);
    const profile = defaultProfile({ maxExpectedRepairs: 500 });
    const s = scoreFor({ repairs, profile });
    expect(s.rejectionReasons.some((r) => r.includes("exceed max"))).toBe(true);
  });

  it("Gate A/B failures appear in rejection reasons", () => {
    const valuation = buildValuationBundle([manualValuation(12000)], 9500); // ratio .79 > .7
    const repairs = summarizeRepairs([]);
    const economics = computeDealEconomics({ askingPrice: 9500, valuation, repairs, config: loadConfig() })!;
    const s = scoreFor({ economics });
    expect(economics.gateA.passed).toBe(false);
    expect(s.rejectionReasons.some((r) => r.startsWith("Gate A failed"))).toBe(true);
  });

  it("total is a weighted average of factor values", () => {
    const s = scoreFor();
    const weighted = Math.round(
      s.factors.reduce((sum, f) => sum + f.value * f.weight, 0) / s.factors.reduce((sum, f) => sum + f.weight, 0),
    );
    expect(s.total).toBe(weighted);
  });
});
