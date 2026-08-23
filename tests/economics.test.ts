import { describe, expect, it } from "vitest";
import { loadConfig } from "@/domain/config";
import { computeDealEconomics } from "@/domain/economics";
import { summarizeRepairs } from "@/domain/repairs";
import { estimateIssue } from "@/domain/repairs";
import { buildValuationBundle } from "@/domain/valuation";
import { manualValuation } from "./fixtures";

function economicsFor(asking: number, reference: number, repairExpected: number) {
  const valuation = buildValuationBundle([manualValuation(reference)], asking);
  const repairs = summarizeRepairs([estimateIssue("TIRES_BRAKES", "MODERATE")]);
  // Override totals to control the scenario precisely.
  repairs.totalLow = repairExpected;
  repairs.totalExpected = repairExpected;
  repairs.totalHigh = repairExpected;
  return computeDealEconomics({ askingPrice: asking, valuation, repairs, config: loadConfig() });
}

describe("computeDealEconomics", () => {
  it("computes all-in basis with every required component", () => {
    const econ = economicsFor(9500, 15000, 1200)!;
    const expected = econ.scenarios.find((s) => s.label === "expected")!;
    expect(expected.components).toEqual({
      askingPrice: 9500,
      expectedRepairs: 1200,
      inspection: 200,
      transportation: 150,
      taxesTitleFees: Math.round(9500 * 0.08), // 760
      immediateMaintenance: 150,
      riskReserve: Math.round(1200 * 0.15 + 200), // 380
      unknownRepairReserve: 0,
    });
    // 9500+1200+200+150+760+150+380 = 12340
    expect(expected.allInBasis).toBe(12340);
  });

  it("applies conservative finished value factor", () => {
    const econ = economicsFor(9500, 15000, 1000)!;
    expect(econ.conservativeFinishedValue).toBe(Math.round(15000 * 0.9)); // 13500
  });

  it("Gate A passes at exactly 70% and fails above", () => {
    expect(economicsFor(10500, 15000, 500)!.gateA.passed).toBe(true); // exactly 0.70
    expect(economicsFor(10600, 15000, 500)!.gateA.passed).toBe(false);
  });

  it("Gate B fails when all-in exceeds 80% of finished value", () => {
    // finished = 13500; need expected all-in > 10800
    // base non-repair costs: 9500*1.08 + 200 + 150 + 150 + reserve(0.15r+200)
    const econ = economicsFor(9500, 15000, 3000)!;
    expect(econ.gateB.passed).toBe(false);
    expect(econ.bothGatesPassed).toBe(false);
  });

  it("orders scenarios best < expected < worst on all-in basis", () => {
    const econ = economicsFor(9500, 15000, 1500)!;
    const [best, expected, worst] = econ.scenarios;
    expect(best.allInBasis).toBeLessThan(expected.allInBasis);
    expect(expected.allInBasis).toBeLessThan(worst.allInBasis);
    expect(econ.expectedMargin).toBe(econ.conservativeFinishedValue - expected.allInBasis);
  });

  it("returns null without valuation or price", () => {
    expect(economicsFor(0, 15000, 500)).toBeNull();
    const valuation = buildValuationBundle([], 9500);
    const repairs = summarizeRepairs([]);
    expect(
      computeDealEconomics({ askingPrice: 9500, valuation, repairs, config: loadConfig() }),
    ).toBeNull();
  });

  it("respects configurable thresholds", () => {
    const strict = loadConfig({ gateARatio: 0.5 });
    const valuation = buildValuationBundle([manualValuation(15000)], 9500);
    const repairs = summarizeRepairs([]);
    const econ = computeDealEconomics({ askingPrice: 9500, valuation, repairs, config: strict });
    expect(econ!.gateA.passed).toBe(false); // 0.633 > 0.5
  });
});
