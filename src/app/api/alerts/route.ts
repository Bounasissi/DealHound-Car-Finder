import { jsonOk, withApi } from "@/lib/api";
import { listAlerts } from "@/lib/repo";

export const GET = withApi("alerts.list", async () => {
  const rows = await listAlerts();
  return jsonOk({ alerts: rows });
});
