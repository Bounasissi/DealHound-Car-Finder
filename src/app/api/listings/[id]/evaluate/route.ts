import { jsonOk, withApi } from "@/lib/api";
import { evaluateAndStore } from "@/lib/evaluate";

type Ctx = { params: Promise<{ id: string }> };

/** Re-run the full evaluation pipeline for a listing. */
export const POST = withApi<Ctx>("listings.evaluate", async (_req, { params }) => {
  const { id } = await params;
  const result = await evaluateAndStore(id);
  return jsonOk({
    evaluation: result.evaluation,
    evaluationId: result.evaluationId,
    alertCreated: result.alertCreated,
  });
});
