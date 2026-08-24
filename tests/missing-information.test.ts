import { describe, expect, it } from "vitest";
import { missingInformation } from "@/domain/missing-information";
import { normalizedListing } from "./fixtures";

describe("missing information", () => {
  it("separates confidence in the evidence from the deal score", () => {
    const result = missingInformation(normalizedListing({ vin: undefined, trim: undefined, mileage: undefined }), null, null, []);
    expect(result.items.map((item) => item.code)).toEqual(expect.arrayContaining(["VIN", "TITLE_HISTORY", "VALUATION"]));
    expect(result.confidence).toBeLessThan(100);
    expect(result.nextAction).toMatch(/VIN|value/i);
  });
});
