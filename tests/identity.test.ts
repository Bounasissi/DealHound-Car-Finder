import { describe, expect, it } from "vitest";
import { hashOpaqueToken, hashPassword, verifyPassword } from "@/lib/passwords";

describe("identity credential primitives", () => {
  it("hashes passwords so the original is not stored and verifies the password", async () => {
    const encoded = await hashPassword("a-long-password-123");

    expect(encoded).not.toContain("a-long-password-123");
    expect(await verifyPassword("a-long-password-123", encoded)).toBe(true);
    expect(await verifyPassword("wrong-password", encoded)).toBe(false);
  });

  it("hashes opaque session tokens deterministically without exposing the token", () => {
    const token = "session-token-value";

    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
    expect(hashOpaqueToken(token)).not.toBe(token);
  });
});
