import { describe, expect, it } from "vitest";
import { validateEnvironment } from "@/domain/environment";

describe("production environment validation", () => {
  it("requires a database and rejects local auth bypass in production", () => {
    expect(validateEnvironment({ NODE_ENV: "production", ALLOW_UNAUTHENTICATED_LOCAL: "true" })).toEqual([
      { code: "DATABASE_URL", message: "DATABASE_URL is required in production" },
      { code: "AUTH_BYPASS", message: "ALLOW_UNAUTHENTICATED_LOCAL must be false in production" },
    ]);
  });

  it("rejects partial object-storage credentials", () => {
    expect(validateEnvironment({ NODE_ENV: "production", DATABASE_URL: "postgres://db", OBJECT_STORAGE_BASE_URL: "https://objects.example" })).toEqual([
      { code: "OBJECT_STORAGE_TOKEN", message: "OBJECT_STORAGE_TOKEN is required when OBJECT_STORAGE_BASE_URL is set" },
    ]);
  });

  it("allows the documented manual development path", () => {
    expect(validateEnvironment({ NODE_ENV: "development", ALLOW_UNAUTHENTICATED_LOCAL: "true" })).toEqual([]);
  });
});
