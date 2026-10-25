import { describe, expect, it } from "vitest";
import { normalizeInspectionStatus, normalizeOfferStatus, normalizeInteractionType } from "@/domain/workflow-records";

describe("workflow record normalization", () => {
  it("accepts only known inspection states", () => {
    expect(normalizeInspectionStatus("passed")).toBe("PASSED");
    expect(normalizeInspectionStatus("unknown")).toBeNull();
  });

  it("accepts only known offer states", () => {
    expect(normalizeOfferStatus("countered")).toBe("COUNTERED");
    expect(normalizeOfferStatus("accepted")).toBe("ACCEPTED");
    expect(normalizeOfferStatus("won")).toBeNull();
  });

  it("normalizes seller interaction types without inventing a state", () => {
    expect(normalizeInteractionType("message")).toBe("MESSAGE");
    expect(normalizeInteractionType("carrier-pigeon")).toBeNull();
  });
});
