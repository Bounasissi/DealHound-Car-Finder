import { jsonError, jsonOk, withApi } from "@/lib/api";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/notification-preferences";
import { z } from "zod";

const input = z.object({ minimumScore: z.number().int().min(0).max(100).optional(), minimumMargin: z.number().min(0).max(1_000_000).optional(), deliveryMode: z.enum(["IMMEDIATE", "DIGEST", "NONE"]).optional(), quietHoursStart: z.number().int().min(0).max(23).nullable().optional(), quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(), email: z.string().email().max(200).nullable().optional() });

export const GET = withApi("preferences.get", async () => jsonOk(await getNotificationPreferences()));
export const PATCH = withApi("preferences.update", async (req) => {
  const body = input.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError(422, "Invalid notification preferences", body.error.issues);
  return jsonOk(await updateNotificationPreferences(body.data));
});
