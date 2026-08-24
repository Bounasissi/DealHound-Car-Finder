import { describe, expect, it } from "vitest";
import { HttpHistoryProvider, HistoryProviderUnavailableError } from "@/sources/history";

describe("HttpHistoryProvider", () => {
  it("rejects an invalid title state instead of treating it as verified evidence", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ titleState: "CLEAN_ENOUGH" }), { status: 200 });
    const provider = new HttpHistoryProvider("https://history.test", "key", 1000, "test-history", "Test history", fetchImpl);
    await expect(provider.check("1HGCM82633A004352")).rejects.toBeInstanceOf(HistoryProviderUnavailableError);
    await expect(provider.check("1HGCM82633A004352")).rejects.toThrow(/invalid titleState/);
  });

  it("rejects malformed brands and odometer arrays", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ brands: ["SALVAGE", 42], odometerReadings: [100, "200"] }), { status: 200 });
    const provider = new HttpHistoryProvider("https://history.test", "key", 1000, "test-history", "Test history", fetchImpl);
    await expect(provider.check("1HGCM82633A004352")).rejects.toThrow(/invalid brands/);
  });

  it("normalizes a valid provider response", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      provider: "history-vendor",
      titleState: "HISTORY_CLEAN",
      brands: ["clean title"],
      accidentCount: 0,
      odometerReadings: [1000, 2000],
      raw: { source: "vendor" },
    }), { status: 200 });
    const provider = new HttpHistoryProvider("https://history.test", "key", 1000, "test-history", "Test history", fetchImpl);
    await expect(provider.check("1HGCM82633A004352")).resolves.toMatchObject({
      provider: "history-vendor",
      titleState: "HISTORY_CLEAN",
      brands: ["CLEAN_TITLE"],
      accidentCount: 0,
      odometerReadings: [1000, 2000],
    });
  });
});
