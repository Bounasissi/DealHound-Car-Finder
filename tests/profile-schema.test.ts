import { describe, expect, it } from "vitest";
import { profileInput } from "@/lib/schemas";

describe("search profile financial gates", () => {
  it("defaults Gate B to an 80% all-in-to-value ceiling", () => {
    const profile = profileInput.parse({ name: "Fixers", zip: "08054" });
    expect(profile.maxAskingRatio).toBe(0.7);
    expect(profile.maxAllInRatio).toBe(0.8);
    expect(profile.requireKbbReference).toBe(true);
  });

  it("rejects unsafe Gate B values", () => {
    expect(() => profileInput.parse({ name: "Fixers", zip: "08054", maxAllInRatio: 0.05 })).toThrow();
  });
});
