export type JobState = "QUEUED" | "RUNNING" | "RETRY" | "SUCCEEDED" | "FAILED";

export interface ClaimableJobState {
  state: JobState;
  lockedUntil: Date | null;
  retryAt: Date | null;
}

export function claimableJob(job: ClaimableJobState, now: Date): boolean {
  if (job.state === "SUCCEEDED" || job.state === "FAILED") return false;
  if (job.lockedUntil && job.lockedUntil > now) return false;
  if ((job.state === "RETRY" || job.state === "QUEUED") && job.retryAt && job.retryAt > now) return false;
  return true;
}

export function backoffUntil(now: Date, attempts: number): Date {
  const seconds = Math.min(15 * 60, 15 * Math.max(1, 2 ** Math.max(0, attempts - 1)));
  return new Date(now.getTime() + seconds * 1000);
}

export function failJob<T extends { state: JobState; attempts: number }>(job: T, error: string, now: Date, maxAttempts: number): T & { state: JobState; error: string; retryAt: Date | null } {
  const attempts = Math.min(maxAttempts, Math.max(job.attempts + (job.state === "RUNNING" ? 1 : 0), job.attempts));
  const terminal = attempts >= maxAttempts;
  return { ...job, state: terminal ? "FAILED" : "RETRY", attempts, error, retryAt: terminal ? null : backoffUntil(now, attempts) };
}
