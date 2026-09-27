export type EnvironmentIssue = { code: string; message: string };

export function validateEnvironment(values: Record<string, string | undefined>): EnvironmentIssue[] {
  const issues: EnvironmentIssue[] = [];
  const production = values.NODE_ENV === "production";
  if (production && !values.DATABASE_URL) issues.push({ code: "DATABASE_URL", message: "DATABASE_URL is required in production" });
  if (production && ["true", "1"].includes(values.ALLOW_UNAUTHENTICATED_LOCAL ?? "")) {
    issues.push({ code: "AUTH_BYPASS", message: "ALLOW_UNAUTHENTICATED_LOCAL must be false in production" });
  }
  if (values.OBJECT_STORAGE_BASE_URL && !values.OBJECT_STORAGE_TOKEN) {
    issues.push({ code: "OBJECT_STORAGE_TOKEN", message: "OBJECT_STORAGE_TOKEN is required when OBJECT_STORAGE_BASE_URL is set" });
  }
  if (values.OBJECT_STORAGE_TOKEN && !values.OBJECT_STORAGE_BASE_URL) {
    issues.push({ code: "OBJECT_STORAGE_BASE_URL", message: "OBJECT_STORAGE_BASE_URL is required when OBJECT_STORAGE_TOKEN is set" });
  }
  return issues;
}
