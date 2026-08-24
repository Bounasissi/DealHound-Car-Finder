import { jsonError, jsonOk, withApi } from "@/lib/api";
import { inspectionInput } from "@/lib/schemas";
import { addInspection, getListing, listInspections } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>("listings.inspections.list", async (_req, { params }) => {
  const { id } = await params;
  if (!(await getListing(id))) return jsonError(404, "Listing not found");
  return jsonOk({ inspections: await listInspections(id) });
});

export const POST = withApi<Ctx>("listings.inspections.create", async (req, { params }) => {
  const { id } = await params;
  const body = inspectionInput.parse(await req.json());
  const created = await addInspection({ listingId: id, ...body });
  if (!created) return jsonError(404, "Listing not found");
  return jsonOk({ recorded: true }, { status: 201 });
});
