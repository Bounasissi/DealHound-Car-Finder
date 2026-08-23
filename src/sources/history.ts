/**
 * History provider abstraction (NMVTIS / approved providers).
 * Without credentials, a clearly-labeled deterministic mock serves the pipeline
 * so title logic is fully exercisable. With credentials, wire the real API in
 * `check()` — same interface, no core changes.
 */
import type { HistoryCheck } from "@/domain/types";
import { normalizeBrands } from "@/domain/title";
import { createHash } from "node:crypto";

export interface HistoryProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  check(vin: string): Promise<HistoryCheck>;
}

export interface NmvtisConfig {
  apiKey: string;
  baseUrl: string;
}

/**
 * Production-shaped NMVTIS mock. Deterministic per VIN: the same VIN always
 * yields the same result, so tests and demos are stable. Results are labeled
 * provider "nmvtis-mock" everywhere they surface.
 */
export class NmvtisMockProvider implements HistoryProvider {
  readonly id = "nmvtis-mock";
  readonly label = "NMVTIS-approved history (MOCK)";

  constructor(private config: NmvtisConfig | null) {}

  isConfigured(): boolean {
    return this.config !== null && this.config.apiKey.length > 0;
  }

  async check(vin: string): Promise<HistoryCheck> {
    if (this.isConfigured()) {
      // Wire point for a real NMVTIS-approved provider (see docs/providers.md).
      throw new Error("Live NMVTIS provider not wired; provide adapter implementation");
    }
    const h = createHash("sha256").update(`dealhound-history:${vin}`).digest();
    const bucket = h[0] % 10;
    const brands: string[] =
      bucket === 0 ? ["SALVAGE"] : bucket === 1 ? ["FLOOD"] : bucket === 2 ? ["REBUILT"] : [];
    const accidentCount = bucket >= 8 ? 1 : 0;
    return {
      provider: this.id,
      vin,
      titleState: "HISTORY_CLEAN",
      brands: normalizeBrands(brands),
      accidentCount,
      odometerReadings: [40_000 + (h[1] % 30) * 1000, 80_000 + (h[2] % 40) * 1000],
      raw: { mock: true, bucket },
      checkedAt: new Date().toISOString(),
    };
  }
}

export const historyProvider = new NmvtisMockProvider(
  process.env.NMVTIS_API_KEY
    ? { apiKey: process.env.NMVTIS_API_KEY, baseUrl: process.env.NMVTIS_BASE_URL ?? "https://example.invalid" }
    : null,
);
