import { jsonError, jsonOk, withApi } from "@/lib/api";
import { canTransition } from "@/domain/workflow";
import { workflowInput } from "@/lib/schemas";
import { getListing, patchListing } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Advance the deal workflow:
 * FOUND → VIN_REQUESTED → VIN_VERIFIED → TITLE_CHECKED → QUESTIONS → INSPECTION → OFFER → PURCHASED/LOST/REJECTED
 */
export const POST = withApi<Ctx>("listings.workflow", async (req, { params }) => {
  const { id } = await params;
  const body = workflowInput.parse(await req.json());
  const listing = await getListing(id);
  if (!listing) return jsonError(404, "Listing not found");

  const from = listing.workflowStage ?? "FOUND";
  const check = canTransition(from, body.to, listing);
  if (!check.allowed) return jsonError(409, check.reason ?? "Transition not allowed");

  const updated = await patchListing(id, {
    workflowStage: body.to,
    workflowTransition: {
      from,
      to: body.to,
      at: new Date().toISOString(),
      actor: "user",
      note: body.note,
    },
  });
  return jsonOk({ listing: updated });
});
