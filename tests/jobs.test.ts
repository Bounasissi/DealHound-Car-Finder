import { describe, expect, it } from "vitest";
import { backoffUntil, claimableJob, failJob, type JobState } from "@/domain/jobs";

describe("durable job state", () => {
  it("claims only queued or retryable jobs whose lock and retry windows are open", () => {
    const now = new Date("2026-08-23T16:00:00Z");
    expect(claimableJob({ state: "QUEUED", lockedUntil: null, retryAt: null }, now)).toBe(true);
    expect(claimableJob({ state: "RUNNING", lockedUntil: new Date("2026-08-23T15:59:00Z"), retryAt: null }, now)).toBe(true);
    expect(claimableJob({ state: "RETRY", lockedUntil: null, retryAt: new Date("2026-08-23T16:01:00Z") }, now)).toBe(false);
  });

  it("backs off and eventually marks a job failed", () => {
    const now = new Date("2026-08-23T16:00:00Z");
    expect(backoffUntil(now, 2)).toEqual(new Date("2026-08-23T16:00:30Z"));
    expect(failJob({ state: "RUNNING", attempts: 1 } as { state: JobState; attempts: number }, "provider down", now, 3)).toMatchObject({ state: "RETRY", attempts: 2, error: "provider down" });
    expect(failJob({ state: "RUNNING", attempts: 3 } as { state: JobState; attempts: number }, "provider down", now, 3)).toMatchObject({ state: "FAILED", attempts: 3, error: "provider down" });
  });
});
