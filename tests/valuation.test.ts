import { describe, expect, it } from "vitest";
import {
  CompsProvider,
  LicensedKbbProvider,
  ManualKbbProvider,
  buildValuationBundle,
} from "@/domain/valuation";
import { normalizedListing } from "./fixtures";
import type { CompSale } from "@/domain/types";

describe("ManualKbbProvider", () => {
  it("returns entered value with high confidence", async () => {
    const p = new ManualKbbProvider(() => 15000);
    const r = await p.getReferenceValue({ listing: normalizedListing() });
    expect(r?.referenceGoodValue).toBe(15000);
    expect(r?.confidence).toBeGreaterThan(0.8);
  });
  it("returns null for missing/invalid entry", async () => {
    const p = new ManualKbbProvider(() => null);
    expect(await p.getReferenceValue({ listing: normalizedListing() })).toBeNull();
  });
});

describe("CompsProvider", () => {
  const comps: CompSale[] = [
    { price: 14000, mileage: 90000, year: 2016, source: "t", observedAt: "now" },
    { price: 15000, mileage: 95000, year: 2016, source: "t", observedAt: "now" },
    { price: 16000, mileage: 100000, year: 2016, source: "t", observedAt: "now" },
    { price: 15500, mileage: 97000, year: 2016, source: "t", observedAt: "now" },
  ];

  it("computes median × good-condition factor", async () => {
    const r = await new CompsProvider().getReferenceValue({ listing: normalizedListing(), comps });
    // median of [14000,15000,15500,16000] = 15250; ×0.95 = 14488 (rounded)
    expect(r?.compMedian).toBe(15250);
    expect(r?.referenceGoodValue).toBe(Math.round(15250 * 0.95));
    expect(r?.compRange).toEqual([14000, 16000]);
  });

  it("requires a minimum comp count", async () => {
    const r = await new CompsProvider().getReferenceValue({
      listing: normalizedListing(),
      comps: comps.slice(0, 2),
    });
    expect(r).toBeNull();
  });

  it("confidence grows with comp count", async () => {
    const few = await new CompsProvider().getReferenceValue({ listing: normalizedListing(), comps });
    const many = await new CompsProvider().getReferenceValue({
      listing: normalizedListing(),
      comps: [...comps, ...comps, ...comps],
    });
    expect(many!.confidence).toBeGreaterThan(few!.confidence);
  });
});

describe("LicensedKbbProvider", () => {
  it("is unconfigured without credentials and never fabricates values", async () => {
    const p = new LicensedKbbProvider(() => false);
    expect(p.isConfigured()).toBe(false);
    expect(await p.getReferenceValue({ listing: normalizedListing() })).toBeNull();
  });

  it("parses a configured licensed-provider response without fabricating data", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      provider: "licensed-test",
      referenceGoodValue: 15200,
      confidence: 0.92,
      notes: "provider response",
    }), { status: 200, headers: { "content-type": "application/json" } });
    const p = new LicensedKbbProvider("https://valuation.test", "key", 1000, fetchImpl);
    const result = await p.getReferenceValue({ listing: normalizedListing() });
    expect(result).toMatchObject({ provider: "licensed-test", referenceGoodValue: 15200, confidence: 0.92 });
  });

  it("fails closed on provider errors", async () => {
    const fetchImpl: typeof fetch = async () => new Response("down", { status: 503 });
    const p = new LicensedKbbProvider("https://valuation.test", "key", 1000, fetchImpl);
    await expect(p.getReferenceValue({ listing: normalizedListing() })).rejects.toThrow(/HTTP 503/);
  });
});

describe("buildValuationBundle", () => {
  it("chooses the LOWEST credible reference (conservative)", () => {
    const bundle = buildValuationBundle(
      [
        { provider: "a", referenceGoodValue: 15000, compMedian: null, compRange: null, confidence: 0.9, notes: "", computedAt: "" },
        { provider: "b", referenceGoodValue: 14000, compMedian: null, compRange: null, confidence: 0.8, notes: "", computedAt: "" },
        { provider: "c", referenceGoodValue: 13000, compMedian: null, compRange: null, confidence: 0.3, notes: "", computedAt: "" }, // below min confidence
      ],
      9500,
    );
    expect(bundle.chosenProvider).toBe("b");
    expect(bundle.referenceGoodValue).toBe(14000);
    expect(bundle.askingRatio).toBeCloseTo(0.6786, 4);
    expect(bundle.discountPct).toBeCloseTo(32.14, 1);
  });

  it("returns zero reference when nothing credible", () => {
    const bundle = buildValuationBundle([], 9500);
    expect(bundle.referenceGoodValue).toBe(0);
    expect(bundle.askingRatio).toBeNull();
  });

  it("skips ratio when no asking price", () => {
    const bundle = buildValuationBundle(
      [{ provider: "a", referenceGoodValue: 15000, compMedian: null, compRange: null, confidence: 0.9, notes: "", computedAt: "" }],
      null,
    );
    expect(bundle.askingRatio).toBeNull();
  });
});
