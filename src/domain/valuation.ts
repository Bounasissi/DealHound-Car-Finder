/**
 * Valuation abstraction. Never scrapes KBB: licensed KBB access, alternative
 * providers, comparable-listing analysis, and manual KBB Good-value entry.
 * Reference selection is conservative (lowest credible source wins).
 */
import type { CompSale, NormalizedListing, ValuationBundle, ValuationResult } from "./types";

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
// Licensed KBB provider placeholder — activates only when credentials exist.
// ---------------------------------------------------------------------------

export class LicensedKbbProvider implements ValuationProvider {
  id = "kbb-licensed";
  label = "Licensed KBB valuation API";
  constructor(private credsPresent: () => boolean, private fetchImpl?: typeof fetch) {}
  isConfigured() { return this.credsPresent(); }
  async getReferenceValue(_q: ValuationQuery): Promise<ValuationResult | null> {
    // Wire point for a licensed data partner (e.g., KBB/ Cox Automotive API).
    // Intentionally returns null until credentials + endpoint are provided;
    // never fabricates values.
    void this.fetchImpl;
    return null;
  }
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
