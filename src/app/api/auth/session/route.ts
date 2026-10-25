import { NextResponse } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { AUTH_COOKIE, authContextForToken, secureCookieForRequest } from "@/lib/auth-token";
import { createSession, findUserByEmail, revokeSession } from "@/lib/identity";
import { verifyPassword } from "@/lib/passwords";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8,
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: unknown; email?: unknown; password?: unknown } | null;
  const authorization = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = typeof body?.token === "string" ? body.token : authorization ?? "";
  let sessionToken = token;
  let context = authContextForToken(token);
  if (!context && typeof body?.email === "string" && typeof body?.password === "string") {
    const user = await findUserByEmail(body.email);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) return jsonError(401, "Invalid email or password");
    const session = await createSession(user.id);
    sessionToken = session.token;
    context = { userId: user.id, role: user.role, email: user.email };
  }
  if (!context) return jsonError(401, "Unauthorized");

  const response = jsonOk({ authenticated: true, userId: context.userId });
  response.cookies.set(AUTH_COOKIE, sessionToken, { ...cookieOptions, secure: secureCookieForRequest(req) });
  return response;
}

export async function DELETE(req: Request) {
  await revokeSession(req.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${AUTH_COOKIE}=`))?.slice(AUTH_COOKIE.length + 1) ?? "");
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(AUTH_COOKIE, "", { ...cookieOptions, secure: secureCookieForRequest(req), maxAge: 0 });
  return response;
}
