import { jsonError, jsonOk, withApi } from "@/lib/api";
import { currentUserId, currentUserRole } from "@/lib/auth";
import { createInvitation } from "@/lib/identity";
import { deliverEmailAlert } from "@/lib/notifications";
import { z } from "zod";

const input = z.object({ email: z.string().email().max(200), role: z.enum(["USER"]).default("USER") });

export const POST = withApi("auth.invite", async (req) => {
  if (currentUserRole() !== "OWNER") return jsonError(403, "Owner access required");
  const body = input.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError(422, "A valid invite email is required", body.error.issues);
  const invitation = await createInvitation(body.data.email, body.data.role, currentUserId());
  const delivery = await deliverEmailAlert({ to: body.data.email, subject: "You are invited to DealHound", text: `Create your DealHound account with this invite token: ${invitation.token}` });
  const includeToken = process.env.NODE_ENV !== "production" || process.env.INCLUDE_INVITE_TOKEN === "true";
  return jsonOk({ invited: true, email: body.data.email, expiresAt: invitation.expiresAt.toISOString(), delivery: delivery.status, ...(includeToken ? { token: invitation.token } : {}) }, { status: 201 });
});
