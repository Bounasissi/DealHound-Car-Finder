import { describe, expect, it } from "vitest";
import { calculateOffer } from "@/domain/offers";

describe("offer calculator", () => {
  it("calculates target, maximum, expected, and worst-case economics", () => {
    const result = calculateOffer({ askingPrice: 8900, conservativeFinishedValue: 15000, expectedRepairs: 1200, highRepairs: 2500, inspectionFee: 200, transport: 150, transactionCosts: 500, targetAllInRatio: 0.8, targetMargin: 2500 });
    expect(result.maximumPurchasePrice).toBe(9950);
    expect(result.suggestedOffer).toBeLessThan(result.maximumPurchasePrice);
    expect(result.expectedMarginAtAsking).toBe(4050);
    expect(result.worstCaseMarginAtAsking).toBe(2750);
  });
});
