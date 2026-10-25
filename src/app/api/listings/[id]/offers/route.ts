import { jsonError, jsonOk, withApi } from "@/lib/api";
import { offerInput } from "@/lib/schemas";
import { addOffer, getListing, listOffers } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>("listings.offers.list", async (_req, { params }) => {
  const { id } = await params;
  if (!(await getListing(id))) return jsonError(404, "Listing not found");
  return jsonOk({ offers: await listOffers(id) });
});

export const POST = withApi<Ctx>("listings.offers.create", async (req, { params }) => {
  const { id } = await params;
  const body = offerInput.parse(await req.json());
  const created = await addOffer({ listingId: id, ...body });
  if (!created) return jsonError(404, "Listing not found");
  return jsonOk({ recorded: true }, { status: 201 });
});
