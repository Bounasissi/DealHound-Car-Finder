/**
 * Deal economics: ALL_IN_BASIS, best/expected/worst scenarios, Gates A & B.
 *
 *   ALL_IN_BASIS = asking price + expected repairs + inspection + transportation
 *                + taxes/title/fees + immediate maintenance + risk reserve
 */
import type { AppConfig } from "./config";
import type { DealEconomics, DealScenario, RepairEstimateSummary, ValuationBundle } from "./types";

export interface EconomicsInput {
  askingPrice: number;
  valuation: ValuationBundle;
  repairs: RepairEstimateSummary;
  config: AppConfig;
  /** Optional profile override; config remains the safe fallback. */
  gateBRatio?: number;
}

export function computeDealEconomics(input: EconomicsInput): DealEconomics | null {
  const { askingPrice, valuation, repairs, config } = input;
  if (!valuation.referenceGoodValue || valuation.referenceGoodValue <= 0) return null;
  if (!askingPrice || askingPrice <= 0) return null;

  const referenceGoodValue = valuation.referenceGoodValue;
  const askingRatio = round(askingPrice / referenceGoodValue, 4);

  // Conservative finished value: post-repair private-party value, haircut from KBB Good.
  const conservativeFinishedValue = Math.round(referenceGoodValue * config.finishedValueFactor);

  // Taxes/title/fees apply to purchase price.
  const taxesTitleFees = Math.round(askingPrice * config.taxTitleFeeRate);
  const immediateMaintenance = config.immediateMaintenanceBase;

  const mkScenario = (
    label: DealScenario["label"],
    repairsCost: number,
    riskReservePct: number,
    riskReserveBase: number,
  ): DealScenario => {
    const unknownRepairReserve = repairs.unknownCosts ? config.unknownRepairReserve : 0;
    const riskReserve = Math.round(repairsCost * riskReservePct + riskReserveBase);
    const components = {
      askingPrice,
      expectedRepairs: repairsCost,
      inspection: config.inspectionFee,
      transportation: config.transportationCost,
      taxesTitleFees,
      immediateMaintenance,
      riskReserve,
      unknownRepairReserve,
    };
    const allInBasis = Object.values(components).reduce((s, v) => s + v, 0);
    const margin = conservativeFinishedValue - allInBasis;
    return {
      label,
      allInBasis,
      components,
      margin,
      marginPct: round((margin / conservativeFinishedValue) * 100, 2),
      allInToValueRatio: round(allInBasis / conservativeFinishedValue, 4),
    };
  };

  const best = mkScenario("best", repairs.totalLow, 0.05, 0);
  const expected = mkScenario("expected", repairs.totalExpected, config.riskReservePct, config.riskReserveBase);
  const worst = mkScenario("worst", repairs.totalHigh, config.riskReservePct * 1.5, config.riskReserveBase * 1.5);

  const gateA = {
    passed: askingRatio <= config.gateARatio,
    detail: `Asking $${askingPrice.toLocaleString()} / reference $${referenceGoodValue.toLocaleString()} = ${askingRatio} (max ${config.gateARatio})`,
  };
  const gateBRatio = input.gateBRatio ?? config.gateBRatio;
  const gateB = {
    passed: expected.allInToValueRatio <= gateBRatio,
    detail: `Expected all-in $${expected.allInBasis.toLocaleString()} / finished value $${conservativeFinishedValue.toLocaleString()} = ${expected.allInToValueRatio} (max ${gateBRatio})`,
  };

  return {
    askingPrice,
    referenceGoodValue,
    askingRatio,
    conservativeFinishedValue,
    scenarios: [best, expected, worst],
    expectedAllInBasis: expected.allInBasis,
    expectedMargin: expected.margin,
    expectedMarginPct: expected.marginPct,
    expectedAllInToValueRatio: expected.allInToValueRatio,
    gateA,
    gateB,
    bothGatesPassed: gateA.passed && gateB.passed,
  };
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
