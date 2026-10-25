import { describe, expect, it } from "vitest";
import {
  buildIssues,
  estimateIssue,
  inferSeverity,
  parseIssuesFromText,
  summarizeRepairs,
  vehicleCostMultiplier,
} from "@/domain/repairs";

describe("parseIssuesFromText", () => {
  it("extracts multiple categories from a listing description", () => {
    const text =
      "Runs good but needs new tires and brakes. AC blows warm. Small dent on rear door. Check engine light is on.";
    const refs = parseIssuesFromText(text);
    const cats = refs.map((r) => r.category).sort();
    expect(cats).toContain("TIRES_BRAKES");
    expect(cats).toContain("HVAC");
    expect(cats).toContain("COSMETIC");
    expect(cats).toContain("ELECTRICAL_SENSORS");
    for (const r of refs) expect(r.confidence).toBeLessThan(0.8); // parsed ≠ inspected
  });

  it("detects major mechanical risk language", () => {
    const refs = parseIssuesFromText("Transmission slipping badly, might need rebuild");
    expect(refs.map((r) => r.category)).toContain("TRANSMISSION_MAJOR");
  });

  it("returns empty for clean text", () => {
    expect(parseIssuesFromText("Perfect condition, nothing wrong")).toHaveLength(0);
  });

  it("does not turn a negated repair statement into an issue", () => {
    const issues = parseIssuesFromText("Clean title. Does NOT need a transmission and no engine problems.");
    expect(issues.some((issue) => issue.category === "TRANSMISSION_MAJOR")).toBe(false);
    expect(issues.some((issue) => issue.category === "ENGINE_MAJOR")).toBe(false);
  });
});

describe("inferSeverity", () => {
  it("escalates with failure language", () => {
    expect(inferSeverity("engine is blown and seized")).toBe("CRITICAL");
    expect(inferSeverity("oil leaks a bit")).toBe("HIGH");
    expect(inferSeverity("will need brakes soon")).toBe("MODERATE");
    expect(inferSeverity("tires")).toBe("LOW");
  });
});

describe("estimateIssue", () => {
  it("produces low < expected < high ranges", () => {
    const issue = estimateIssue("TIRES_BRAKES", "MODERATE");
    expect(issue.estimateLow).toBeLessThan(issue.estimateExpected);
    expect(issue.estimateExpected).toBeLessThan(issue.estimateHigh);
  });

  it("scales with severity", () => {
    const low = estimateIssue("HVAC", "LOW");
    const critical = estimateIssue("HVAC", "CRITICAL");
    expect(critical.estimateExpected).toBeGreaterThan(low.estimateExpected);
  });

  it("marks major categories as majorRisk", () => {
    expect(estimateIssue("ENGINE_MAJOR", "MODERATE").majorRisk).toBe(true);
    expect(estimateIssue("TRANSMISSION_MAJOR", "LOW").majorRisk).toBe(true);
    expect(estimateIssue("RUST_FRAME_FLOOD_FIRE", "LOW").majorRisk).toBe(true);
    expect(estimateIssue("COSMETIC", "CRITICAL").majorRisk).toBe(false);
  });
});

describe("vehicleCostMultiplier", () => {
  it("raises luxury costs and lowers mainstream", () => {
    const bmw = vehicleCostMultiplier({ year: 2016, make: "BMW", model: "328i", trim: null, bodyClass: null, fuelType: null, engineCylinders: null });
    const toyota = vehicleCostMultiplier({ year: 2016, make: "Toyota", model: "Camry", trim: null, bodyClass: null, fuelType: null, engineCylinders: null });
    const truck = vehicleCostMultiplier({ year: 2016, make: "Ford", model: "F-150", trim: null, bodyClass: "Truck", fuelType: null, engineCylinders: null });
    expect(bmw).toBeGreaterThan(1.2);
    expect(toyota).toBeLessThan(1);
    expect(truck).toBeGreaterThan(toyota * 0 + 1.0);
  });
});

describe("buildIssues", () => {
  it("user issues override parsed issues in the same category", () => {
    const parsed = parseIssuesFromText("needs new tires");
    const user = estimateIssue("TIRES_BRAKES", "HIGH", { source: "INSPECTION", confidence: 0.95 });
    const issues = buildIssues({ parsedRefs: parsed, userIssues: [user] });
    const tires = issues.filter((i) => i.category === "TIRES_BRAKES");
    expect(tires).toHaveLength(1);
    expect(tires[0].source).toBe("INSPECTION");
  });
});

describe("summarizeRepairs", () => {
  it("marks an empty finding set as unknown rather than zero-cost", () => {
    const summary = summarizeRepairs([]);
    expect(summary.unknownCosts).toBe(true);
    expect(summary.unknownReason).toMatch(/No repair findings/);
  });

  it("totals ranges and flags rejected categories against profile rules", () => {
    const issues = [
      estimateIssue("COSMETIC", "LOW"),
      estimateIssue("ENGINE_MAJOR", "MODERATE"),
      estimateIssue("TRANSMISSION_MAJOR", "MODERATE"),
    ];
    const summary = summarizeRepairs(issues, {
      rejectedCategories: ["ENGINE_MAJOR", "TRANSMISSION_MAJOR"],
    });
    expect(summary.totalLow).toBeGreaterThan(0);
    expect(summary.totalHigh).toBeGreaterThan(summary.totalExpected);
    expect(summary.totalExpected).toBeGreaterThan(summary.totalLow);
    expect(summary.hasMajorRisk).toBe(true);
    expect(summary.rejectedCategories.sort()).toEqual(["ENGINE_MAJOR", "TRANSMISSION_MAJOR"]);
  });
});
