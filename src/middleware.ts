import { NextResponse, type NextRequest } from "next/server";
import { authContextForToken, localAuthBypassAllowed, tokenFromRequest } from "@/lib/auth-token";

export function middleware(request: NextRequest) {
  if (localAuthBypassAllowed()) return NextResponse.next();
  if (authContextForToken(tokenFromRequest(request))) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
