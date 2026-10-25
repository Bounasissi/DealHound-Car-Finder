import { jsonError, jsonOk, withApi } from "@/lib/api";
import { getChecklistInspection, updateChecklistItem } from "@/lib/repo";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };
const input = z.object({ code: z.string().min(1).max(80), result: z.enum(["PASS", "FAIL", "UNKNOWN", "NOT_CHECKED"]), note: z.string().max(1000).nullable().optional() });

export const GET = withApi<Ctx>("listings.inspection.get", async (_req, { params }) => {
  const { id } = await params;
  const inspection = await getChecklistInspection(id);
  return inspection ? jsonOk({ inspection }) : jsonError(404, "Listing not found");
});

export const PATCH = withApi<Ctx>("listings.inspection.update", async (req, { params }) => {
  const { id } = await params;
  const body = input.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError(422, "Invalid inspection item", body.error.issues);
  if (!(await updateChecklistItem(id, body.data.code, body.data.result, body.data.note))) return jsonError(404, "Listing or inspection item not found");
  return jsonOk({ inspection: await getChecklistInspection(id) });
});
