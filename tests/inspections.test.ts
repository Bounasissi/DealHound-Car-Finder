import { describe, expect, it } from "vitest";
import { DEFAULT_INSPECTION_ITEMS, inspectionSummary } from "@/domain/inspections";

describe("inspection workflow", () => {
  it("starts with a practical checklist and summarizes unknown items", () => {
    expect(DEFAULT_INSPECTION_ITEMS.map((item) => item.code)).toEqual(expect.arrayContaining(["VIN_MATCH", "COLD_START", "FRAME", "ROAD_TEST"]));
    expect(inspectionSummary([{ code: "VIN_MATCH", result: "PASS" }, { code: "FRAME", result: "UNKNOWN" }])).toMatchObject({ passed: 1, unknown: 1, complete: false });
  });
});
