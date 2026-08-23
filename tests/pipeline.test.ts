import { describe, expect, it } from "vitest";
import { evaluateListing } from "@/domain/pipeline";
import { cleanHistory, evalInput, normalizedListing, salvageHistory } from "./fixtures";
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

  it("overpriced listing fails Gate A and scores lower", () => {
    const listing = normalizedListing({ price: 13500 }); // ratio .9
    const result = evaluateListing(evalInput({ listing }));
    expect(result.economics!.gateA.passed).toBe(false);
    expect(result.score.total).toBeLessThan(70);
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

  it("full payload is JSON-serializable for audit storage", () => {
    const result = evaluateListing(evalInput());
    const json = JSON.parse(JSON.stringify(result));
    expect(json.score.total).toBe(result.score.total);
  });
});
