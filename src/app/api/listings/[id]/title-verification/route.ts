import { jsonOk, withApi } from "@/lib/api";
import { titleVerificationInput } from "@/lib/schemas";
import { evaluateAndStore } from "@/lib/evaluate";
import { getListing, patchListing } from "@/lib/repo";
import type { TitleClaim } from "@/domain/types";

type Ctx = { params: Promise<{ id: string }> };

/** Record a seller claim or a manually reviewed document without fabricating a provider check. */
export const POST = withApi<Ctx>("listings.titleVerification", async (req, { params }) => {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) throw new Error("Listing not found");
  const body = titleVerificationInput.parse(await req.json());
  const claim: TitleClaim = {
    claim: body.state === "DOCUMENT_REVIEWED" ? "manual title document reviewed" : body.state === "SELLER_CLAIMS_CLEAN" ? "seller reports clean title" : "manual verification incomplete",
    claimedClean: body.state !== "UNKNOWN",
    source: "USER_INPUT",
    capturedAt: new Date().toISOString(),
    evidenceNote: body.evidenceNote,
  };
  const updated = await patchListing(id, {
    titleState: body.state,
    titleClaims: [...listing.titleClaims, claim],
  });
  if (!updated) throw new Error("Listing not found");
  const evaluation = await evaluateAndStore(id);
  return jsonOk({ listing: updated, evaluation: evaluation.evaluation });
});
