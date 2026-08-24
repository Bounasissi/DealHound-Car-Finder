/**
 * Valuation abstraction. Never scrapes KBB: licensed KBB access, alternative
 * providers, comparable-listing analysis, and manual KBB Good-value entry.
 * Reference selection is conservative (lowest credible source wins).
 */
import type { CompSale, NormalizedListing, ValuationBasis, ValuationBundle, ValuationResult } from "./types";
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
      basis: "KBB_GOOD",
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
      basis: "COMPARABLES",
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.url.replace(/\/$/, "")}/valuations`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ vehicle: query.listing.vehicle, mileage: query.listing.mileage, askingPrice: query.listing.price }),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`Valuation provider timed out after ${this.timeoutMs}ms`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`Valuation provider returned HTTP ${response.status}`);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error("Valuation provider returned invalid JSON");
    }
    if (!isRecord(body)) throw new Error("Valuation provider returned an invalid payload");
    const referenceGoodValue = body.referenceGoodValue;
    const confidence = body.confidence;
    if (typeof referenceGoodValue !== "number" || !Number.isFinite(referenceGoodValue) || referenceGoodValue <= 0) return null;
    if (confidence !== undefined && (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)) return null;
    return {
      provider: typeof body.provider === "string" && body.provider.trim() ? body.provider : this.id,
      basis: "KBB_GOOD",
      referenceGoodValue,
      compMedian: null,
      compRange: null,
      confidence: confidence ?? 0.8,
      notes: typeof body.notes === "string" ? body.notes : "Licensed provider response",
      computedAt: new Date().toISOString(),
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function configuredLicensedKbbProvider(): LicensedKbbProvider {
  const config = loadConfig();
  return new LicensedKbbProvider(config.valuationProviderUrl, config.valuationProviderApiKey, config.valuationTimeoutMs);
}

// ---------------------------------------------------------------------------
// Optional MarketCheck predicted-value provider. This is a market proxy, not
// KBB. It is opt-in because the product's target benchmark remains KBB Good.
// ---------------------------------------------------------------------------

export interface MarketCheckPriceConfig {
  apiKey: string;
  baseUrl?: string;
  /** Used when the listing location does not contain a five-digit ZIP. */
  zip?: string;
  timeoutMs?: number;
  enabled?: boolean;
  confidence?: number;
  fetchImpl?: typeof fetch;
}

export class MarketCheckPriceProvider implements ValuationProvider {
  id = "marketcheck-price";
  label = "MarketCheck predicted market value";

  constructor(private readonly config: MarketCheckPriceConfig) {}

  isConfigured() {
    return Boolean(this.config.enabled && this.config.apiKey.trim());
  }

  async getReferenceValue(query: ValuationQuery): Promise<ValuationResult | null> {
    if (!this.isConfigured() || !query.listing.vin || !/^[A-HJ-NPR-Z0-9]{17}$/i.test(query.listing.vin)) return null;
    const zip = extractZip(query.listing.location) ?? this.config.zip?.trim();
    if (!zip) return null;

    const url = new URL("/v2/predict/car/us/marketcheck_price", this.config.baseUrl || "https://api.marketcheck.com");
    url.searchParams.set("api_key", this.config.apiKey);
    url.searchParams.set("vin", query.listing.vin);
    url.searchParams.set("dealer_type", "independent");
    url.searchParams.set("zip", zip);
    url.searchParams.set("is_certified", "false");
    if (query.listing.mileage !== null) url.searchParams.set("miles", String(query.listing.mileage));

    const controller = new AbortController();
    const timeoutMs = this.config.timeoutMs ?? 8000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await (this.config.fetchImpl ?? fetch)(url.toString(), {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`MarketCheck price request timed out after ${timeoutMs}ms`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`MarketCheck price returned HTTP ${response.status}`);

    const body = (await response.json()) as { marketcheck_price?: number };
    const value = body.marketcheck_price;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
    const confidence = Math.max(0, Math.min(1, this.config.confidence ?? 0.7));
    return {
      provider: this.id,
      basis: "MARKET_PROXY",
      referenceGoodValue: value,
      compMedian: null,
      compRange: null,
      confidence,
      notes: `MarketCheck predicted market value for VIN ${query.listing.vin} near ZIP ${zip}; not a KBB Good-condition value. Confirm with KBB before purchase.`,
      computedAt: new Date().toISOString(),
    };
  }
}

export function configuredMarketCheckPriceProvider(): MarketCheckPriceProvider {
  const config = loadConfig();
  return new MarketCheckPriceProvider({
    apiKey: config.marketCheckApiKey,
    baseUrl: config.marketCheckBaseUrl,
    zip: config.marketCheckPriceZip,
    timeoutMs: config.marketCheckTimeoutMs,
    enabled: config.marketCheckPriceEnabled,
    confidence: config.marketCheckPriceConfidence,
  });
}

export function valuationBasisFor(result: Pick<ValuationResult, "provider" | "basis">): ValuationBasis {
  if (result.basis && result.basis !== "UNKNOWN") return result.basis;
  if (result.provider === "manual-kbb-entry" || result.provider === "kbb-licensed" || result.provider.startsWith("kbb-")) return "KBB_GOOD";
  if (result.provider === "comps") return "COMPARABLES";
  if (result.provider === "marketcheck-price") return "MARKET_PROXY";
  return "UNKNOWN";
}

function extractZip(location: string | null): string | null {
  const match = location?.match(/\b\d{5}(?:-\d{4})?\b/);
  return match ? match[0].slice(0, 5) : null;
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
  // Keep the full history in the returned bundle, but only compare the latest
  // result from each provider. A stale low manual entry must not permanently
  // make a corrected listing look cheaper than it is.
  const latestByProvider = new Map<string, ValuationResult>();
  for (const result of [...results].sort((a, b) => valuationTime(b) - valuationTime(a))) {
    if (!latestByProvider.has(result.provider)) latestByProvider.set(result.provider, result);
  }
  const credible = [...latestByProvider.values()].filter((r) => r.confidence >= minConfidence && r.referenceGoodValue > 0);
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
    chosenBasis: chosen ? valuationBasisFor(chosen) : "UNKNOWN",
    askingRatio,
    discountAmount,
    discountPct,
  };
}

function valuationTime(result: ValuationResult): number {
  const parsed = Date.parse(result.computedAt);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
