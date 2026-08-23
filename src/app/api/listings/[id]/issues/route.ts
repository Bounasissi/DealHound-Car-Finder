import { jsonError, jsonOk, withApi } from "@/lib/api";
import { estimateIssue } from "@/domain/repairs";
import { userIssueInput } from "@/lib/schemas";
import { evaluateAndStore } from "@/lib/evaluate";
import { addUserIssue } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

/** Add a user/inspection-confirmed repair issue and re-evaluate. */
export const POST = withApi<Ctx>("listings.addIssue", async (req, { params }) => {
  const { id } = await params;
  const body = userIssueInput.parse(await req.json());
  const issue = estimateIssue(body.category, body.severity, {
    description: body.description,
    confidence: 0.95,
    source: "USER_INPUT",
    majorRiskOverride: body.majorRisk,
  });
  issue.estimateExpected = Math.round(body.estimateExpected);
  issue.estimateLow = Math.round(body.estimateExpected * 0.6);
  issue.estimateHigh = Math.round(body.estimateExpected * 1.6);

  const added = await addUserIssue(id, issue);
  if (!added) return jsonError(404, "Listing not found");
  const evaluation = await evaluateAndStore(id);
  return jsonOk({ evaluation: evaluation.evaluation });
});
