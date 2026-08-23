import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE } from "./auth-token";
import { runWithAuth, serverAuthContext } from "./auth";

/** Establishes the authenticated owner before a server component reads data. */
export async function withServerAuth<T>(fn: () => Promise<T>): Promise<T> {
  const cookieStore = await cookies();
  const context = serverAuthContext(cookieStore.get(AUTH_COOKIE)?.value ?? "");
  if (!context) redirect("/login");
  return runWithAuth(context, fn);
}
