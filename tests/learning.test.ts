import { describe, expect, it } from "vitest";
import { aggregateCalibration, computePredictionError } from "@/domain/learning";
import { evaluateListing } from "@/domain/pipeline";
import { evalInput } from "./fixtures";
import type { DealEvaluation, OutcomeRecord, PurchaseOutcome } from "@/domain/types";

function evaluation(): DealEvaluation {
  return evaluateListing(evalInput());
}

describe("computePredictionError", () => {
  it("computes signed errors vs predictions", () => {
    const e = evaluation();
    const actual: PurchaseOutcome = {
      actualRepairs: e.repairs.totalExpected + 500,
      actualFinishedValue: (e.economics?.conservativeFinishedValue ?? 0) - 300,
      actualAllIn: (e.economics?.expectedAllInBasis ?? 0) + 400,
      actualMargin: (e.economics?.expectedMargin ?? 0) - 700,
      soldPrice: null,
    };
    const err = computePredictionError(e, actual);
    expect(err.repairsErrorAbs).toBe(500);
    expect(err.repairsErrorPct).toBeGreaterThan(0);
    expect(err.finishedValueErrorAbs).toBe(-300);
    expect(err.allInErrorAbs).toBe(400);
    expect(err.marginErrorAbs).toBe(-700);
    expect(err.direction).toBe("UNDERESTIMATED_COST");
  });

  it("on-target within ±10%", () => {
    const e = evaluation();
    const err = computePredictionError(e, {
      actualRepairs: Math.round(e.repairs.totalExpected * 1.05),
      actualFinishedValue: null,
      actualAllIn: null,
      actualMargin: null,
      soldPrice: null,
    });
    expect(err.direction).toBe("ON_TARGET");
  });

  it("handles null economics gracefully", () => {
    const e = evaluateListing(evalInput({ valuations: [] }));
    const err = computePredictionError(e, {
      actualRepairs: 1000, actualFinishedValue: null, actualAllIn: null, actualMargin: null, soldPrice: null,
    });
    expect(err.finishedValueErrorAbs).toBeNull();
    expect(err.marginErrorAbs).toBeNull();
  });
});

describe("aggregateCalibration", () => {
  it("aggregates purchase outcomes only", () => {
    const e = evaluation();
    const mk = (repairsDelta: number): OutcomeRecord => ({
      listingId: "l",
      outcome: "PURCHASED",
      recordedAt: "now",
      purchase: {} as PurchaseOutcome,
      predictionError: computePredictionError(e, {
        actualRepairs: Math.round(e.repairs.totalExpected * repairsDelta),
        actualFinishedValue: null, actualAllIn: null, actualMargin: null, soldPrice: null,
      }),
    });
    const records = [mk(1.2), mk(0.8), mk(1.0), { listingId: "x", outcome: "SCAM", recordedAt: "now" }];
    const stats = aggregateCalibration(records);
    expect(stats.purchases).toBe(3);
    expect(stats.underestimates).toBe(1);
    expect(stats.overestimates).toBe(1);
    expect(stats.onTarget).toBe(1);
    expect(stats.avgRepairsErrorPct).not.toBeNull();
  });
});
