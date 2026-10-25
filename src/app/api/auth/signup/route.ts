import { jsonError, jsonOk } from "@/lib/api";
import { acceptInvitation, countUsers, createSession, createUser, findUserByEmail, normalizeEmail } from "@/lib/identity";
import { z } from "zod";
import { AUTH_COOKIE, secureCookieForRequest } from "@/lib/auth-token";

const input = z.object({ email: z.string().email().max(200), password: z.string().min(12).max(200), inviteToken: z.string().min(20).max(200).optional() });
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 8 };

export async function POST(req: Request) {
  const body = input.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError(422, "A valid email and password of at least 12 characters are required", body.error.issues);
  if (await findUserByEmail(body.data.email)) return jsonError(409, "An account already exists for that email");
  const user = body.data.inviteToken
    ? await acceptInvitation(body.data.inviteToken, body.data.password, body.data.email)
    : await createUser(normalizeEmail(body.data.email), body.data.password, (await countUsers()) === 0 ? "OWNER" : "USER");
  if (!user || (body.data.inviteToken && user.email !== normalizeEmail(body.data.email))) return jsonError(400, "Invitation is invalid, expired, or does not match this email");
  const session = await createSession(user.id);
  const response = jsonOk({ authenticated: true, userId: user.id, email: user.email, role: user.role }, { status: 201 });
  response.cookies.set(AUTH_COOKIE, session.token, { ...cookieOptions, secure: secureCookieForRequest(req) });
  return response;
}
