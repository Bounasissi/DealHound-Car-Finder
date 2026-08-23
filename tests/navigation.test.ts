import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/navigation";

describe("safeNextPath", () => {
  it("accepts same-origin absolute paths", () => {
    expect(safeNextPath("/listings/123?tab=history")).toBe("/listings/123?tab=history");
  });

  it("rejects scheme-relative and absolute URLs", () => {
    expect(safeNextPath("//evil.example/login")).toBe("/");
    expect(safeNextPath("https://evil.example/login")).toBe("/");
  });
});
