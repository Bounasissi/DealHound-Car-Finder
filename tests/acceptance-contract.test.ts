import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("friend acceptance contract", () => {
  it("documents the complete no-developer workflow", () => {
    const acceptance = readFileSync("docs/FRIEND-ACCEPTANCE.md", "utf8");
    for (const requirement of ["Sign up", "search profile", "Facebook listing", "evidence confidence", "inspection checklist", "suggested offer", "second account"]) {
      expect(acceptance.toLowerCase()).toContain(requirement.toLowerCase());
    }
  });
});
