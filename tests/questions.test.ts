import { describe, expect, it } from "vitest";
import { generateSellerQuestions } from "@/domain/questions";
import { defaultProfile, normalizedListing } from "./fixtures";
import { estimateIssue } from "@/domain/repairs";

describe("generateSellerQuestions", () => {
  it("asks for VIN when missing (HIGH priority)", () => {
    const listing = normalizedListing({ vin: undefined });
    const qs = generateSellerQuestions(listing, [], defaultProfile(), { hasHistoryCheck: false, distanceMiles: 10 });
    const vinQ = qs.find((q) => q.category === "VIN");
    expect(vinQ).toBeDefined();
    expect(vinQ!.priority).toBe("HIGH");
  });

  it("asks title status when unknown", () => {
    const listing = normalizedListing();
    listing.titleState = "UNKNOWN";
    listing.titleClaims = [];
    const qs = generateSellerQuestions(listing, [], defaultProfile(), { hasHistoryCheck: false, distanceMiles: null });
    expect(qs.some((q) => q.id === "q-title-status")).toBe(true);
  });

  it("asks about major mechanical issues with HIGH priority", () => {
    const issue = estimateIssue("TRANSMISSION_MAJOR", "HIGH", { source: "TEXT_PARSE" });
    const qs = generateSellerQuestions(normalizedListing(), [issue], defaultProfile(), { hasHistoryCheck: true, distanceMiles: null });
    const q = qs.find((x) => x.category === "MECHANICAL" && x.priority === "HIGH");
    expect(q).toBeDefined();
    expect(q!.question.toLowerCase()).toContain("transmission");
  });

  it("confirms clean-title sale terms when profile requires clean", () => {
    const qs = generateSellerQuestions(normalizedListing(), [], defaultProfile({ requireCleanTitle: true }), { hasHistoryCheck: true, distanceMiles: null });
    expect(qs.some((q) => q.id === "q-clean-confirm")).toBe(true);
  });

  it("asks logistics question for long distance", () => {
    const qs = generateSellerQuestions(normalizedListing(), [], defaultProfile(), { hasHistoryCheck: true, distanceMiles: 250 });
    expect(qs.some((q) => q.category === "LOGISTICS")).toBe(true);
  });

  it("sorts by priority", () => {
    const listing = normalizedListing({ vin: undefined });
    const issue = estimateIssue("ENGINE_MAJOR", "CRITICAL", { source: "USER_INPUT" });
    const qs = generateSellerQuestions(listing, [issue], defaultProfile(), { hasHistoryCheck: false, distanceMiles: null });
    const priorities = qs.map((q) => q.priority);
    expect(priorities.indexOf("LOW")).toBeGreaterThan(priorities.indexOf("HIGH"));
  });

  it("every question carries a why", () => {
    const qs = generateSellerQuestions(normalizedListing({ vin: undefined }), [], defaultProfile(), { hasHistoryCheck: false, distanceMiles: null });
    for (const q of qs) expect(q.why.length).toBeGreaterThan(10);
  });
});
