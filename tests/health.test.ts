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
      backupRestore: "unconfigured",
      monitoring: "unconfigured",
    });

    expect(result).toEqual({
      mode: "manual-user-assisted",
      ready: false,
      missing: ["valuation-provider", "history-provider", "inventory-source", "scheduled-jobs", "object-storage", "backup-restore", "monitoring"],
    });
  });

  it("reports automated readiness only when every unattended dependency is configured", () => {
    expect(assessReleaseReadiness({
      valuation: "configured",
      history: "configured",
      inventory: "configured",
      jobs: "configured",
      storage: "configured",
      backupRestore: "configured",
      monitoring: "configured",
    })).toEqual({ mode: "automated", ready: true, missing: [] });
  });

  it("does not treat a cron secret alone as proof of production operations", () => {
    const result = assessReleaseReadiness({
      valuation: "configured",
      history: "configured",
      inventory: "configured",
      jobs: "configured",
      storage: "configured",
      backupRestore: "unconfigured",
      monitoring: "configured",
    });

    expect(result).toEqual({ mode: "manual-user-assisted", ready: false, missing: ["backup-restore"] });
  });
});
