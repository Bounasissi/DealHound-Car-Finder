import { describe, expect, it } from "vitest";
import { assessReleaseReadiness } from "@/domain/health";

describe("assessReleaseReadiness", () => {
  it("reports manual mode without claiming unattended production readiness", () => {
    const result = assessReleaseReadiness({
      valuation: "manual-or-comps",
      history: "manual-review",
      inventory: "manual-only",
      jobs: "unconfigured",
      storage: "local-development",
    });

    expect(result).toEqual({
      mode: "manual-user-assisted",
      ready: false,
      missing: ["valuation-provider", "history-provider", "inventory-source", "scheduled-jobs", "object-storage"],
    });
  });

  it("reports automated readiness only when every unattended dependency is configured", () => {
    expect(assessReleaseReadiness({
      valuation: "configured",
      history: "configured",
      inventory: "configured",
      jobs: "configured",
      storage: "configured",
    })).toEqual({ mode: "automated", ready: true, missing: [] });
  });
});
