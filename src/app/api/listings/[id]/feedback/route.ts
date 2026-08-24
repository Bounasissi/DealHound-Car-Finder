import { jsonError, jsonOk, withApi } from "@/lib/api";
import { saveListingFeedback } from "@/lib/repo";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };
const input = z.object({ category: z.enum(["WRONG_VALUATION", "WRONG_REPAIR", "WRONG_TITLE", "DUPLICATE", "BAD_SCORE", "BROKEN_LISTING", "OTHER"]), message: z.string().min(3).max(4000) });

export const POST = withApi<Ctx>("listings.feedback", async (req, { params }) => {
  const { id } = await params;
  const body = input.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError(422, "Invalid feedback", body.error.issues);
  if (!(await saveListingFeedback(id, body.data.category, body.data.message))) return jsonError(404, "Listing not found");
  return jsonOk({ recorded: true }, { status: 201 });
});
