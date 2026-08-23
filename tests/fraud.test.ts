import { describe, expect, it } from "vitest";
import { assessFraud } from "@/domain/fraud";
import { buildValuationBundle } from "@/domain/valuation";
import { loadConfig } from "@/domain/config";
import { manualValuation } from "./fixtures";
import { normalizedListing } from "./fixtures";

function fraudFor(text: string, opts: { ratio?: number; vinMismatch?: boolean; duplicates?: number } = {}) {
  const listing = normalizedListing({
    description: text,
    vin: opts.vinMismatch ? "1HGCM82633A004352" : undefined,
  });
  const valuation = buildValuationBundle(
    [manualValuation(opts.ratio !== undefined ? listing.price! / opts.ratio : 15000)],
    listing.price,
  );
  return assessFraud({ listing, valuation, vinMismatch: opts.vinMismatch ?? false, duplicateCount: opts.duplicates ?? 0, config: loadConfig() });
}

describe("assessFraud", () => {
  it("clean listing has low risk", () => {
    const f = fraudFor("Great car, runs well. Cash or bank transfer at meet-up.");
    expect(f.riskScore).toBeLessThanOrEqual(10);
    expect(f.requiresEnhancedScrutiny).toBe(false);
  });

  it("flags deposit-before-viewing", () => {
    const f = fraudFor("Send a $200 deposit to hold the car");
    expect(f.flags.some((x) => x.code === "DEPOSIT_BEFORE_VIEWING")).toBe(true);
  });

  it("flags shipping-only sales", () => {
    const f = fraudFor("I will ship the car to you, payment via wire transfer only");
    expect(f.flags.some((x) => x.code === "SHIPPING_ONLY")).toBe(true);
    expect(f.flags.some((x) => x.code === "SCAM_LANGUAGE")).toBe(true);
  });

  it("flags VIN mismatch as critical", () => {
    const f = fraudFor("great deal", { vinMismatch: true });
    expect(f.flags.find((x) => x.code === "VIN_MISMATCH")?.severity).toBe("CRITICAL");
    expect(f.requiresEnhancedScrutiny).toBe(true);
  });

  it("flags seller not on title / lost title", () => {
    const f = fraudFor("Title is in my wife's name, she's out of state");
    expect(f.flags.some((x) => x.code === "SELLER_NOT_ON_TITLE")).toBe(true);
  });

  it("extreme bargains require enhanced scrutiny", () => {
    const f = fraudFor("priced to move today", { ratio: 0.3 });
    expect(f.flags.some((x) => x.code === "EXTREME_BARGAIN")).toBe(true);
    expect(f.requiresEnhancedScrutiny).toBe(true);
  });

  it("normal bargains do not trigger scrutiny threshold", () => {
    const f = fraudFor("good condition", { ratio: 0.65 });
    expect(f.flags.some((x) => x.code === "EXTREME_BARGAIN")).toBe(false);
  });

  it("duplicate listings add points", () => {
    const f = fraudFor("same car", { duplicates: 2 });
    expect(f.flags.some((x) => x.code === "DUPLICATE_LISTING")).toBe(true);
  });

  it("caps risk score at 100", () => {
    const f = fraudFor(
      "deposit to hold, will ship the car, title in wife's name, zelle only, urgent sale must sell today",
      { vinMismatch: true, duplicates: 3 },
    );
    expect(f.riskScore).toBe(100);
  });

  it("missing VIN is a warning when manually ingested", () => {
    const listing = normalizedListing({ vin: undefined });
    const valuation = buildValuationBundle([manualValuation(15000)], listing.price);
    const f = assessFraud({ listing, valuation, vinMismatch: false, duplicateCount: 0, config: loadConfig() });
    expect(f.flags.some((x) => x.code === "NO_VIN_PROVIDED")).toBe(true);
  });
});
