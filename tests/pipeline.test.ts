import { describe, expect, it } from "vitest";
import { evaluateListing } from "@/domain/pipeline";
import { evalInput, normalizedListing, salvageHistory } from "./fixtures";
import { estimateIssue } from "@/domain/repairs";

describe("evaluateListing — end to end", () => {
  it("exceptional deal: clean history, ratio 0.50, minor repairs → gates pass, STRONG_BUY+", () => {
    const listing = normalizedListing({ price: 7500 });
    const result = evaluateListing(evalInput({ listing }));
    expect(result.hardRejected).toBe(false);
    expect(result.economics!.gateA.passed).toBe(true);
    expect(result.economics!.gateB.passed).toBe(true);
    expect(result.score.total).toBeGreaterThanOrEqual(80);
    expect(result.titleState).toBe("HISTORY_CLEAN");
    expect(result.suggestedStage).toBe("TITLE_CHECKED");
    // Parsed issues from fixture text (tires/brakes) present
    expect(result.repairs.issues.some((i) => i.category === "TIRES_BRAKES")).toBe(true);
  });

  it("salvage brand hard-rejects regardless of score", () => {
    const listing = normalizedListing();
    const result = evaluateListing(
      evalInput({ listing, historyCheck: salvageHistory(listing.vin!) }),
    );
    expect(result.hardRejected).toBe(true);
    expect(result.hardRejectReasons.some((r) => r.includes("SALVAGE"))).toBe(true);
  });

  it("seller 'clean title' claim alone never satisfies clean-title requirement", () => {
    const listing = normalizedListing({ vin: undefined });
    const result = evaluateListing(
      evalInput({ listing, historyCheck: null }),
    );
    expect(result.titleState).toBe("SELLER_CLAIMS_CLEAN");
    expect(result.hardRejected).toBe(true); // profile requires clean title
    expect(result.score.rejectionReasons.join(" ")).toContain("clean title");
  });

  it("major rejected repair category blocks the deal", () => {
    const issues = [estimateIssue("TRANSMISSION_MAJOR", "HIGH", { source: "USER_INPUT", confidence: 0.95 })];
    const result = evaluateListing(evalInput({ userIssues: issues }));
    expect(result.repairs.rejectedCategories).toContain("TRANSMISSION_MAJOR");
    expect(result.score.rejectionReasons.some((r) => r.includes("Rejected repair categories"))).toBe(true);
  });

  it("treats repairs outside an allowlist as rejected categories", () => {
    const listing = normalizedListing({ description: "Needs tires and the A/C blows warm." });
    const result = evaluateListing(evalInput({
      listing,
      profile: { ...evalInput().profile, allowedRepairCategories: ["TIRES_BRAKES"] },
    }));
    expect(result.repairs.rejectedCategories).toContain("HVAC");
    expect(result.score.rejectionReasons.some((r) => r.includes("HVAC"))).toBe(true);
  });

  it("requires repair evidence when the search profile is repair-focused", () => {
    const listing = normalizedListing({
      description: "2016 Toyota Camry LE. Clean title, runs and drives, $9,500.",
    });
    const result = evaluateListing(evalInput({ listing, profile: { ...evalInput().profile, requireRepairEvidence: true } }));
    expect(result.repairs.issues).toHaveLength(0);
    expect(result.hardRejected).toBe(true);
    expect(result.score.rejectionReasons.some((reason) => reason.includes("repair evidence"))).toBe(true);
  });

  it("requires KBB Good provenance by default but allows explicit exploratory proxy mode", () => {
    const proxyValuation = {
      provider: "marketcheck-price",
      basis: "MARKET_PROXY" as const,
      referenceGoodValue: 15000,
      compMedian: null,
      compRange: null,
      confidence: 0.7,
      notes: "proxy",
      computedAt: "2026-08-24T12:00:00.000Z",
    };
    const strict = evaluateListing(evalInput({ valuations: [proxyValuation] }));
    expect(strict.hardRejected).toBe(true);
    expect(strict.score.rejectionReasons.some((reason) => reason.includes("requires KBB Good valuation"))).toBe(true);

    const exploratory = evaluateListing(evalInput({
      valuations: [proxyValuation],
      profile: { ...evalInput().profile, requireKbbReference: false },
    }));
    expect(exploratory.hardRejected).toBe(false);
  });

  it("overpriced listing fails Gate A and scores lower", () => {
    const listing = normalizedListing({ price: 13500 }); // ratio .9
    const result = evaluateListing(evalInput({ listing }));
    expect(result.economics!.gateA.passed).toBe(false);
    expect(result.score.total).toBeLessThan(70);
  });

  it("applies the active profile's all-in ratio threshold", () => {
    const result = evaluateListing(evalInput({
      profile: { ...evalInput().profile, maxAllInRatio: 0.6 },
    }));
    expect(result.economics!.gateB.passed).toBe(false);
    expect(result.score.rejectionReasons.some((reason) => reason.includes("Gate B failed"))).toBe(true);
  });

  it("no valuation → economics null + rejection reason", () => {
    const result = evaluateListing(evalInput({ valuations: [] }));
    expect(result.economics).toBeNull();
    expect(result.valuation.referenceGoodValue).toBe(0);
    expect(result.score.rejectionReasons.some((r) => r.includes("valuation"))).toBe(true);
  });

  it("VIN decode mismatch flows into fraud as critical flag", () => {
    const listing = normalizedListing({ year: 2016, make: "toyota", model: "Camry" });
    const result = evaluateListing(
      evalInput({
        listing,
        vinDecode: {
          vin: listing.vin!, valid: true,
          attributes: { year: 2015, make: "Honda", model: "Accord", trim: null, bodyClass: null, fuelType: null, engineCylinders: null },
          matchConfidence: 0.9, mismatches: [], decodedAt: "now", source: "nhtsa-vpic",
        },
      }),
    );
    expect(result.vinDecode!.mismatches.length).toBeGreaterThan(0);
    expect(result.fraud.flags.some((f) => f.code === "VIN_MISMATCH")).toBe(true);
    expect(result.fraud.requiresEnhancedScrutiny).toBe(true);
  });

  it("evaluation is deterministic for identical inputs", () => {
    const a = evaluateListing(evalInput());
    const b = evaluateListing(evalInput());
    expect(a.score.total).toBe(b.score.total);
    expect(a.economics!.expectedAllInBasis).toBe(b.economics!.expectedAllInBasis);
  });

  it("carries duplicate evidence into the fraud assessment", () => {
    const result = evaluateListing(evalInput({ duplicateCount: 2 }));
    expect(result.fraud.flags.some((flag) => flag.code === "DUPLICATE_LISTING")).toBe(true);
  });

  it("full payload is JSON-serializable for audit storage", () => {
    const result = evaluateListing(evalInput());
    const json = JSON.parse(JSON.stringify(result));
    expect(json.score.total).toBe(result.score.total);
  });
});
