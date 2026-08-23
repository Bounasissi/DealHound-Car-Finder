import { NextResponse } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { AUTH_COOKIE, authContextForToken } from "@/lib/auth-token";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 8,
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const authorization = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = typeof body?.token === "string" ? body.token : authorization ?? "";
  const context = authContextForToken(token);
  if (!context) return jsonError(401, "Unauthorized");

  const response = jsonOk({ authenticated: true, userId: context.userId });
  response.cookies.set(AUTH_COOKIE, token, cookieOptions);
  return response;
}

export function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(AUTH_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
