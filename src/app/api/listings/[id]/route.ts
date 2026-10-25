import { jsonError, jsonOk, withApi } from "@/lib/api";
import { generateSellerQuestions } from "@/domain/questions";
import { listingPatchInput } from "@/lib/schemas";
import { getActiveProfile } from "@/lib/evaluate";
import { getListing, latestEvaluation, patchListing } from "@/lib/repo";
import { defaultProfile } from "@/domain/profile-defaults";
import type { SearchProfile } from "@/domain/types";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>("listings.get", async (_req, { params }) => {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return jsonError(404, "Listing not found");
  const evaluation = await latestEvaluation(id);
  const profile: SearchProfile = (await getActiveProfile()) ?? defaultProfile();
  const questions = generateSellerQuestions(
    listing,
    evaluation?.repairs.issues ?? [],
    profile,
    {
      hasHistoryCheck: Boolean(evaluation) && evaluation!.titleState !== "UNKNOWN",
      distanceMiles: null,
    },
  );
  return jsonOk({ listing, evaluation, questions });
});

export const PATCH = withApi<Ctx>("listings.patch", async (req, { params }) => {
  const { id } = await params;
  const patch = listingPatchInput.parse(await req.json());
  const updated = await patchListing(id, patch);
  if (!updated) return jsonError(404, "Listing not found");
  return jsonOk({ listing: updated });
});
