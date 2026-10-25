import { jsonError, jsonOk, withApi } from "@/lib/api";
import { CompsProvider, ManualKbbProvider, MarketCheckPriceProvider, buildValuationBundle, configuredLicensedKbbProvider, configuredMarketCheckPriceProvider } from "@/domain/valuation";
import { valuationInput } from "@/lib/schemas";
import { evaluateAndStore } from "@/lib/evaluate";
import { addValuation, getListing } from "@/lib/repo";
import type { CompSale } from "@/domain/types";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Add a valuation (manual KBB Good entry or comparable set) and re-evaluate.
 * Never scrapes KBB — manual entry or licensed providers only.
 */
export const POST = withApi<Ctx>("listings.valuation", async (req, { params }) => {
  const { id } = await params;
  const body = valuationInput.parse(await req.json());
  const listing = await getListing(id);
  if (!listing) throw new Error("Listing not found");

  let result = null;
  if (body.provider === "licensed-kbb") {
    const provider = configuredLicensedKbbProvider();
    if (!provider.isConfigured()) return jsonError(503, "Licensed valuation provider is not configured", { retryable: true });
    try {
      result = await provider.getReferenceValue({ listing });
    } catch (error) {
      return jsonError(503, error instanceof Error ? error.message : "Licensed valuation provider failed", { retryable: true });
    }
    if (!result) throw new Error("Licensed valuation provider is unavailable or returned no credible value");
  } else if (body.provider === "marketcheck-price") {
    const configured = configuredMarketCheckPriceProvider();
    const provider = configured.isConfigured() ? configured : new MarketCheckPriceProvider({ apiKey: "" });
    if (!provider.isConfigured()) return jsonError(503, "MarketCheck predicted-value provider is not enabled/configured", { retryable: true });
    try {
      result = await provider.getReferenceValue({ listing });
    } catch (error) {
      return jsonError(503, error instanceof Error ? error.message : "MarketCheck predicted-value provider failed", { retryable: true });
    }
    if (!result) throw new Error("MarketCheck requires a valid VIN and a five-digit listing/configured ZIP");
  } else if (body.provider === "manual-kbb-entry") {
    if (!body.referenceGoodValue) throw new Error("referenceGoodValue required for manual KBB entry");
    const provider = new ManualKbbProvider(() => body.referenceGoodValue!);
    result = await provider.getReferenceValue({ listing });
  } else {
    const comps: CompSale[] = (body.comps ?? []).map((c) => ({
      price: c.price,
      mileage: c.mileage ?? null,
      year: c.year ?? null,
      source: c.source,
      observedAt: c.observedAt ?? new Date().toISOString(),
    }));
    const provider = new CompsProvider();
    result = await provider.getReferenceValue({ listing, comps });
    // Store the raw comps alongside for audit via notes.
    if (result && body.comps?.length) {
      result = { ...result, notes: `${result.notes} Comps: ${JSON.stringify(body.comps)}` };
    }
  }
  if (!result) throw new Error("Valuation provider returned no result (insufficient data?)");

  await addValuation(id, result);
  const bundle = buildValuationBundle([result], listing.price);
  const evaluation = await evaluateAndStore(id);
  return jsonOk({ valuation: result, bundle, evaluation: evaluation.evaluation });
});
