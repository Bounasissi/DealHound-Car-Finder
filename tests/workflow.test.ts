import { describe, expect, it } from "vitest";
import { canTransition, suggestStage } from "@/domain/workflow";
import { normalizedListing } from "./fixtures";

const withVin = normalizedListing();
const noVin = normalizedListing({ vin: undefined });

describe("canTransition", () => {
  const historyClean = normalizedListing();
  historyClean.titleState = "HISTORY_CLEAN";

  it("follows the forward pipeline sequentially", () => {
    const stages = ["FOUND", "VIN_REQUESTED", "VIN_VERIFIED", "TITLE_CHECKED", "QUESTIONS", "INSPECTION", "OFFER", "PURCHASED"] as const;
    for (let i = 0; i < stages.length - 1; i++) {
      expect(canTransition(stages[i], stages[i + 1], historyClean).allowed).toBe(true);
    }
  });

  it("blocks skipping stages", () => {
    expect(canTransition("FOUND", "INSPECTION", withVin).allowed).toBe(false);
    expect(canTransition("FOUND", "PURCHASED", withVin).allowed).toBe(false);
  });

  it("requires VIN before VIN_VERIFIED", () => {
    const r = canTransition("VIN_REQUESTED", "VIN_VERIFIED", noVin);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("without a VIN");
  });

  it("requires history-clean title before TITLE_CHECKED", () => {
    const claimedOnly = normalizedListing();
    claimedOnly.titleState = "SELLER_CLAIMS_CLEAN";
    expect(canTransition("VIN_VERIFIED", "TITLE_CHECKED", claimedOnly).allowed).toBe(false);
    expect(canTransition("VIN_VERIFIED", "TITLE_CHECKED", historyClean).allowed).toBe(true);
  });

  it("REJECTED reachable from any active stage", () => {
    for (const stage of ["FOUND", "QUESTIONS", "OFFER"] as const) {
      expect(canTransition(stage, "REJECTED", historyClean).allowed).toBe(true);
    }
  });

  it("LOST only from QUESTIONS onward", () => {
    expect(canTransition("FOUND", "LOST", historyClean).allowed).toBe(false);
    expect(canTransition("QUESTIONS", "LOST", historyClean).allowed).toBe(true);
    expect(canTransition("OFFER", "LOST", historyClean).allowed).toBe(true);
  });

  it("terminal states are terminal", () => {
    expect(canTransition("PURCHASED", "FOUND", historyClean).allowed).toBe(false);
    expect(canTransition("REJECTED", "FOUND", historyClean).allowed).toBe(false);
  });
});

describe("suggestStage", () => {
  it("asks for VIN when missing", () => {
    expect(suggestStage(noVin, { hasHistoryCheck: false })).toBe("VIN_REQUESTED");
  });
  it("verifies VIN when present but unchecked", () => {
    expect(suggestStage(withVin, { hasHistoryCheck: false })).toBe("VIN_VERIFIED");
  });
  it("moves to TITLE_CHECKED after history check on claimed-only state", () => {
    const claimed = normalizedListing();
    claimed.titleState = "SELLER_CLAIMS_CLEAN";
    expect(suggestStage(claimed, { hasHistoryCheck: true })).toBe("TITLE_CHECKED");
  });
  it("reaches QUESTIONS once document-reviewed", () => {
    const reviewed = normalizedListing();
    reviewed.titleState = "DOCUMENT_REVIEWED";
    expect(suggestStage(reviewed, { hasHistoryCheck: true })).toBe("QUESTIONS");
  });
});
