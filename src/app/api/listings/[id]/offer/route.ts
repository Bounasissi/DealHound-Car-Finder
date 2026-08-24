import { jsonError, jsonOk, withApi } from "@/lib/api";
import { calculateOffer } from "@/domain/offers";
import { loadConfig } from "@/domain/config";
import { getListing, latestEvaluation, saveCalculatedOffer } from "@/lib/repo";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };
const input = z.object({ conservativeFinishedValue: z.number().min(100).max(1_000_000).optional(), expectedRepairs: z.number().min(0).max(100_000).optional(), highRepairs: z.number().min(0).max(200_000).optional(), targetAllInRatio: z.number().min(0.1).max(1.5).default(0.8), targetMargin: z.number().min(0).max(1_000_000).default(2000), inspectionFee: z.number().min(0).optional(), transport: z.number().min(0).optional(), transactionCosts: z.number().min(0).optional() });

export const POST = withApi<Ctx>("listings.offer.calculate", async (req, { params }) => {
  const { id } = await params;
  const body = input.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError(422, "Invalid offer inputs", body.error.issues);
  const listing = await getListing(id);
  if (!listing || listing.price === null) return jsonError(404, "Listing with asking price not found");
  const evaluation = await latestEvaluation(id);
  const config = loadConfig();
  const value = body.data.conservativeFinishedValue ?? evaluation?.economics?.conservativeFinishedValue ?? evaluation?.valuation.referenceGoodValue;
  if (!value) return jsonError(422, "Add a valuation before calculating an offer");
  const expectedRepairs = body.data.expectedRepairs ?? evaluation?.repairs.totalExpected ?? 0;
  const highRepairs = body.data.highRepairs ?? evaluation?.repairs.totalHigh ?? expectedRepairs;
  const result = calculateOffer({ askingPrice: listing.price, conservativeFinishedValue: value, expectedRepairs, highRepairs, inspectionFee: body.data.inspectionFee ?? config.inspectionFee, transport: body.data.transport ?? config.transportationCost, transactionCosts: body.data.transactionCosts ?? Math.round(listing.price * config.taxTitleFeeRate), targetAllInRatio: body.data.targetAllInRatio, targetMargin: body.data.targetMargin });
  await saveCalculatedOffer(id, result);
  return jsonOk({ offer: result }, { status: 201 });
});
