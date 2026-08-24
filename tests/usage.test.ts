import { describe, expect, it } from "vitest";
import { consumeUsage, defaultUsageLimits } from "@/domain/usage";

describe("usage ceilings", () => {
  it("allows usage below a limit and rejects the increment that crosses it", () => {
    expect(consumeUsage(2, 3)).toEqual({ allowed: true, next: 3 });
    expect(consumeUsage(3, 3)).toEqual({ allowed: false, next: 3 });
  });

  it("defines bounded defaults for expensive operations", () => {
    const limits = defaultUsageLimits();
    expect(limits.listingImports).toBeGreaterThan(0);
    expect(limits.aiAnalyses).toBeGreaterThan(0);
    expect(limits.providerCalls).toBeGreaterThan(limits.aiAnalyses);
  });
});
