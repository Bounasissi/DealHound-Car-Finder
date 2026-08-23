import { describe, expect, it } from "vitest";
import { filterDeals, type DealFilter, type DealInboxItem } from "@/lib/deal-filters";

const baseFilter: DealFilter = {
  query: "",
  maxAskingRatio: 0.7,
  title: "history-clean",
  needsWork: true,
  maxExpectedRepairs: null,
  minScore: null,
  sort: "best",
};

function deal(overrides: Partial<DealInboxItem> = {}): DealInboxItem {
  return {
    id: "1",
    headline: "2014 Honda Accord EX",
    year: 2014,
    make: "Honda",
    model: "Accord",
    trim: "EX",
    price: 6000,
    mileage: 118000,
    location: "Mount Laurel, NJ",
    url: "https://www.facebook.com/marketplace/item/1",
    score: 86,
    scoreClass: "STRONG_BUY",
    askingRatio: 0.6,
    referenceValue: 10000,
    discountPct: 40,
    expectedMargin: 2500,
    titleState: "HISTORY_CLEAN",
    stage: "FOUND",
    hardRejected: false,
    repairExpected: 900,
    repairCount: 2,
    hasRepairEvidence: true,
    ...overrides,
  };
}

describe("filterDeals", () => {
  it("keeps a clean-title repair candidate at or below the target ratio", () => {
    expect(filterDeals([deal()], baseFilter)).toHaveLength(1);
  });

  it("rejects missing valuation, weak title evidence, and over-target pricing", () => {
    const items = [
      deal({ id: "missing-value", askingRatio: null }),
      deal({ id: "seller-claim", titleState: "SELLER_CLAIMS_CLEAN" }),
      deal({ id: "too-expensive", askingRatio: 0.71 }),
    ];
    expect(filterDeals(items, baseFilter)).toHaveLength(0);
  });

  it("requires explicit repair evidence when needsWork is enabled", () => {
    expect(filterDeals([deal({ hasRepairEvidence: false, repairCount: 0 })], baseFilter)).toHaveLength(0);
    expect(filterDeals([deal({ hasRepairEvidence: false, repairCount: 0 })], { ...baseFilter, needsWork: false })).toHaveLength(1);
  });

  it("supports text, repair-cost, score, and best-deal sorting", () => {
    const items = [
      deal({ id: "two", headline: "2017 Toyota Camry", make: "Toyota", askingRatio: 0.62, repairExpected: 500, score: 82 }),
      deal({ id: "one", askingRatio: 0.55, repairExpected: 1200, score: 91 }),
    ];
    const filtered = filterDeals(items, { ...baseFilter, query: "camry", maxExpectedRepairs: 1000, minScore: 80 });
    expect(filtered.map((item) => item.id)).toEqual(["two"]);

    const sorted = filterDeals(items, { ...baseFilter, needsWork: false, sort: "best" });
    expect(sorted.map((item) => item.id)).toEqual(["one", "two"]);
  });
});
