import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("listing identity migration", () => {
  it("repoints dependent records before removing duplicate listings", () => {
    const sql = readFileSync("drizzle/0003_evaluation_version_and_listing_dedup.sql", "utf8");
    expect(sql).toContain("CREATE TEMP TABLE listing_dedup_map");
    expect(sql).toMatch(/UPDATE evaluations[\s\S]*listing_dedup_map/);
    expect(sql).toMatch(/UPDATE outcomes[\s\S]*listing_dedup_map/);
    expect(sql).toMatch(/DELETE FROM listings[\s\S]*listing_dedup_map/);
    expect(sql.indexOf("DELETE FROM listings")).toBeLessThan(sql.indexOf("CREATE UNIQUE INDEX"));
  });
});
