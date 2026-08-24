import { jsonError, jsonOk, withApi } from "@/lib/api";
import { interactionInput } from "@/lib/schemas";
import { addSellerInteraction, getListing, listSellerInteractions } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>("listings.interactions.list", async (_req, { params }) => {
  const { id } = await params;
  if (!(await getListing(id))) return jsonError(404, "Listing not found");
  return jsonOk({ interactions: await listSellerInteractions(id) });
});

export const POST = withApi<Ctx>("listings.interactions.create", async (req, { params }) => {
  const { id } = await params;
  const body = interactionInput.parse(await req.json());
  const created = await addSellerInteraction({ listingId: id, ...body });
  if (!created) return jsonError(404, "Listing not found");
  return jsonOk({ recorded: true }, { status: 201 });
});
