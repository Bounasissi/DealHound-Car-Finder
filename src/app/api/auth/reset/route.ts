import { jsonError, jsonOk } from "@/lib/api";
import { createPasswordReset, resetPassword } from "@/lib/identity";
import { z } from "zod";

const requestInput = z.object({ email: z.string().email().max(200) });
const consumeInput = z.object({ token: z.string().min(20).max(200), password: z.string().min(12).max(200) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as unknown;
  if (typeof body === "object" && body !== null && "token" in body) {
    const parsed = consumeInput.safeParse(body);
    if (!parsed.success) return jsonError(422, "A valid reset token and password are required", parsed.error.issues);
    if (!(await resetPassword(parsed.data.token, parsed.data.password))) return jsonError(400, "Reset token is invalid or expired");
    return jsonOk({ reset: true });
  }
  const parsed = requestInput.safeParse(body);
  if (!parsed.success) return jsonError(422, "A valid email is required", parsed.error.issues);
  const reset = await createPasswordReset(parsed.data.email);
  const includeToken = process.env.NODE_ENV !== "production" || process.env.INCLUDE_RESET_TOKEN === "true";
  return jsonOk({ accepted: true, ...(reset && includeToken ? { token: reset.token, expiresAt: reset.expiresAt.toISOString() } : {}) });
}
