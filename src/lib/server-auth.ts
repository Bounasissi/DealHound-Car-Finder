import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE } from "./auth-token";
import { runWithAuth, serverAuthContextAsync } from "./auth";

/** Establishes the authenticated owner before a server component reads data. */
export async function withServerAuth<T>(fn: () => Promise<T>): Promise<T> {
  const cookieStore = await cookies();
  const context = await serverAuthContextAsync(cookieStore.get(AUTH_COOKIE)?.value ?? "");
  if (!context) redirect("/login");
  return runWithAuth(context, fn);
}
