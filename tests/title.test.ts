import { describe, expect, it } from "vitest";
import {
  deriveTitleState,
  evaluateHardRejects,
  isAuthoritativeCleanTitle,
  normalizeBrands,
  parseTitleClaims,
  satisfiesCleanTitleRequirement,
} from "@/domain/title";
import type { HistoryCheck } from "@/domain/types";

describe("parseTitleClaims", () => {
  it("detects clean-title claims", () => {
    const claims = parseTitleClaims("Clean title in hand, only 2 owners");
    expect(claims.some((c) => c.claim === "clean title" && c.claimedClean)).toBe(true);
  });

  it("detects bad claims: salvage, rebuilt, flood", () => {
    const claims = parseTitleClaims("Was a salvage title, rebuilt after minor accident");
    expect(claims.filter((c) => !c.claimedClean).map((c) => c.claim)).toEqual(
      expect.arrayContaining(["salvage title", "rebuilt title"]),
    );
  });

  it("never marks a claim as verified — source is recorded", () => {
    const [claim] = parseTitleClaims("clean title", "SELLER_MESSAGE");
    expect(claim.source).toBe("SELLER_MESSAGE");
    expect(claim.claimedClean).toBe(true);
  });
});

describe("deriveTitleState", () => {
  it("UNKNOWN with no evidence", () => {
    expect(deriveTitleState([], null)).toBe("UNKNOWN");
  });

  it("SELLER_CLAIMS_CLEAN from claim alone — never higher", () => {
    const state = deriveTitleState(parseTitleClaims("clean title"), null);
    expect(state).toBe("SELLER_CLAIMS_CLEAN");
  });

  it("history check outranks claims", () => {
    const history: HistoryCheck = {
      provider: "nmvtis-mock", vin: "X", titleState: "DOCUMENT_REVIEWED",
      brands: [], accidentCount: null, odometerReadings: [], checkedAt: "now",
    };
    expect(deriveTitleState(parseTitleClaims("clean title"), history)).toBe("DOCUMENT_REVIEWED");
  });
});

describe("normalizeBrands", () => {
  it("maps provider brand strings to canonical codes", () => {
    expect(normalizeBrands(["SALVAGE TITLE", "Flood Damage", "Rebuildable"])).toEqual([
      "SALVAGE", "FLOOD", "REBUILT",
    ]);
  });
});

describe("evaluateHardRejects", () => {
  it("rejects salvage/rebuilt/flood/junk/parts/destruction brands", () => {
    for (const brand of ["SALVAGE", "REBUILT", "FLOOD", "JUNK", "PARTS_ONLY", "CERTIFICATE_OF_DESTRUCTION"]) {
      const history: HistoryCheck = {
        provider: "t", vin: "V", titleState: "HISTORY_CLEAN",
        brands: [brand], accidentCount: null, odometerReadings: [], checkedAt: "now",
      };
      expect(evaluateHardRejects(history, [], false).rejected).toBe(true);
    }
  });

  it("rejects VIN mismatch", () => {
    expect(evaluateHardRejects(null, [], true).reasons).toContain(
      "VIN mismatch between listing and decoded vehicle",
    );
  });

  it("allows explicit brand override (auditable)", () => {
    const history: HistoryCheck = {
      provider: "t", vin: "V", titleState: "HISTORY_CLEAN",
      brands: ["REBUILT"], accidentCount: null, odometerReadings: [], checkedAt: "now",
    };
    const result = evaluateHardRejects(history, [], false, ["rebuilt"]);
    expect(result.rejected).toBe(false);
  });

  it("clean history passes", () => {
    const history: HistoryCheck = {
      provider: "t", vin: "V", titleState: "HISTORY_CLEAN",
      brands: [], accidentCount: 0, odometerReadings: [], checkedAt: "now",
    };
    expect(evaluateHardRejects(history, [], false).rejected).toBe(false);
  });

  it("hard-rejects an explicit branded-title seller claim even without provider history", () => {
    const claims = parseTitleClaims("salvage title, rebuilt after flood damage");
    const result = evaluateHardRejects(null, claims, false);
    expect(result.rejected).toBe(true);
    expect(result.reasons.join(" ")).toContain("SALVAGE");
  });
});

describe("satisfiesCleanTitleRequirement", () => {
  it("requires authoritative history when clean title is required", () => {
    expect(satisfiesCleanTitleRequirement("UNKNOWN", true)).toBe(false);
    expect(satisfiesCleanTitleRequirement("SELLER_CLAIMS_CLEAN", true)).toBe(false);
    expect(satisfiesCleanTitleRequirement("HISTORY_CLEAN", true)).toBe(true);
    expect(satisfiesCleanTitleRequirement("DOCUMENT_REVIEWED", true)).toBe(false);
    expect(satisfiesCleanTitleRequirement("VERIFIED", true)).toBe(true);
  });

  it("distinguishes document review from authoritative history", () => {
    expect(isAuthoritativeCleanTitle("DOCUMENT_REVIEWED")).toBe(false);
    expect(isAuthoritativeCleanTitle("HISTORY_CLEAN")).toBe(true);
    expect(isAuthoritativeCleanTitle("VERIFIED")).toBe(true);
  });
  it("skips check when not required", () => {
    expect(satisfiesCleanTitleRequirement("UNKNOWN", false)).toBe(true);
  });
});
