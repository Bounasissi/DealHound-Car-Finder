import { describe, expect, it } from "vitest";
import { validateUpload } from "@/lib/storage";

describe("photo upload validation", () => {
  it("accepts supported image types within the limit", () => {
    expect(validateUpload({ type: "image/jpeg", size: 1024 * 1024, name: "listing.jpg" })).toEqual({ ok: true, extension: "jpg" });
  });

  it("rejects executable, oversized, and misleading uploads", () => {
    expect(validateUpload({ type: "application/javascript", size: 10, name: "x.js" }).ok).toBe(false);
    expect(validateUpload({ type: "image/png", size: 11 * 1024 * 1024, name: "x.png" }).ok).toBe(false);
    expect(validateUpload({ type: "image/png", size: 10, name: "x.jpg" }).ok).toBe(false);
  });
});
