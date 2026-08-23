/**
 * Valuation abstraction. Never scrapes KBB: licensed KBB access, alternative
 * providers, comparable-listing analysis, and manual KBB Good-value entry.
 * Reference selection is conservative (lowest credible source wins).
 */
import type { CompSale, NormalizedListing, ValuationBundle, ValuationResult } from "./types";
import { loadConfig } from "./config";

export interface ValuationQuery {
  listing: NormalizedListing;
  /** Comparable sales observed from any source (marketplace history, sold feeds). */
  comps?: CompSale[];
}

export interface ValuationProvider {
  /** Stable provider id, e.g. "kbb-licensed", "manual-kbb-entry", "comps". */
  id: string;
  label: string;
  isConfigured(): boolean;
  getReferenceValue(query: ValuationQuery): Promise<ValuationResult | null>;
}

// ---------------------------------------------------------------------------
// Manual KBB entry — always available; user reads KBB and types the Good value.
// ---------------------------------------------------------------------------

export class ManualKbbProvider implements ValuationProvider {
  id = "manual-kbb-entry";
  label = "Manual KBB Good-value entry";
  constructor(private getEnteredValue: (q: ValuationQuery) => number | null) {}
  isConfigured() { return true; }
  async getReferenceValue(q: ValuationQuery): Promise<ValuationResult | null> {
    const v = this.getEnteredValue(q);
    if (!v || v <= 0 || !Number.isFinite(v)) return null;
    return {
      provider: this.id,
      referenceGoodValue: v,
      compMedian: null,
      compRange: null,
      confidence: 0.85,
      notes: "User-entered KBB Good-condition private-party value.",
      computedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Comparable-listings provider — median of observed comps, haircut to Good condition.
// ---------------------------------------------------------------------------

export class CompsProvider implements ValuationProvider {
  id = "comps";
  label = "Comparable listings median";
  constructor(
    private opts: {
      /** Comps are typically mixed condition; haircut median to approximate Good. */
      goodConditionFactor?: number;
      minComps?: number;
    } = {},
  ) {}
  isConfigured() { return true; }
  async getReferenceValue(q: ValuationQuery): Promise<ValuationResult | null> {
    const comps = (q.comps ?? []).filter((c) => Number.isFinite(c.price) && c.price > 0);
    const minComps = this.opts.minComps ?? 3;
    if (comps.length < minComps) return null;
    const prices = comps.map((c) => c.price).sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    const median =
      prices.length % 2 === 0 ? Math.round((prices[mid - 1] + prices[mid]) / 2) : prices[mid];
    const factor = this.opts.goodConditionFactor ?? 0.95;
    const reference = Math.round(median * factor);
    return {
      provider: this.id,
      referenceGoodValue: reference,
      compMedian: median,
      compRange: [prices[0], prices[prices.length - 1]],
      confidence: Math.min(0.9, 0.5 + comps.length * 0.05),
      notes: `Median of ${comps.length} comps × ${factor} Good-condition factor.`,
      computedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Licensed valuation provider boundary. The vendor contract returns a
// KBB-Good-equivalent value and provenance; no value is fabricated locally.
// ---------------------------------------------------------------------------

export class LicensedKbbProvider implements ValuationProvider {
  id = "kbb-licensed";
  label = "Licensed valuation API";
  constructor(
    private readonly url: string | (() => boolean),
    private readonly apiKey = "",
    private readonly timeoutMs = 8000,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}
  isConfigured() {
    return typeof this.url === "string" ? Boolean(this.url && this.apiKey) : this.url();
  }
  async getReferenceValue(query: ValuationQuery): Promise<ValuationResult | null> {
    if (typeof this.url !== "string" || !this.isConfigured()) return null;
    const response = await Promise.race([
      this.fetchImpl(`${this.url.replace(/\/$/, "")}/valuations`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ vehicle: query.listing.vehicle, mileage: query.listing.mileage, askingPrice: query.listing.price }),
      }),
      new Promise<Response>((_, reject) => setTimeout(() => reject(new Error(`Valuation provider timed out after ${this.timeoutMs}ms`)), this.timeoutMs)),
    ]);
    if (!response.ok) throw new Error(`Valuation provider returned HTTP ${response.status}`);
    const body = (await response.json()) as { referenceGoodValue?: number; confidence?: number; notes?: string; provider?: string };
    if (!body.referenceGoodValue || body.referenceGoodValue <= 0) return null;
    return {
      provider: body.provider ?? this.id,
      referenceGoodValue: body.referenceGoodValue,
      compMedian: null,
      compRange: null,
      confidence: body.confidence ?? 0.8,
      notes: body.notes ?? "Licensed provider response",
      computedAt: new Date().toISOString(),
    };
  }
}

export function configuredLicensedKbbProvider(): LicensedKbbProvider {
  const config = loadConfig();
  return new LicensedKbbProvider(config.valuationProviderUrl, config.valuationProviderApiKey, config.valuationTimeoutMs);
}

// ---------------------------------------------------------------------------
// Bundle: conservative multi-source reference + ratio math
// ---------------------------------------------------------------------------

/**
 * Choose the conservative reference: among credible results (confidence >= minConfidence),
 * take the LOWEST reference value so we never overstate a deal.
 */
export function buildValuationBundle(
  results: ValuationResult[],
  askingPrice: number | null,
  minConfidence = 0.5,
): ValuationBundle {
  const credible = results.filter((r) => r.confidence >= minConfidence && r.referenceGoodValue > 0);
  const chosen =
    credible.length > 0
      ? credible.reduce((lo, r) => (r.referenceGoodValue < lo.referenceGoodValue ? r : lo))
      : null;

  let askingRatio: number | null = null;
  let discountAmount: number | null = null;
  let discountPct: number | null = null;
  if (chosen && askingPrice && askingPrice > 0) {
    askingRatio = round(askingPrice / chosen.referenceGoodValue, 4);
    discountAmount = chosen.referenceGoodValue - askingPrice;
    discountPct = round((discountAmount / chosen.referenceGoodValue) * 100, 2);
  }

  return {
    results,
    referenceGoodValue: chosen?.referenceGoodValue ?? 0,
    chosenProvider: chosen?.provider ?? "none",
    askingRatio,
    discountAmount,
    discountPct,
  };
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
