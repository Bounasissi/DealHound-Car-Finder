import { AsyncLocalStorage } from "node:async_hooks";
import { loadConfig } from "@/domain/config";
import { authContextForToken, localAuthBypassAllowed, tokenFromRequest, type AuthContext } from "./auth-token";
import { resolveSession } from "./identity";

export type { AuthContext } from "./auth-token";

const storage = new AsyncLocalStorage<AuthContext>();

export function runWithAuth<T>(context: AuthContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn);
}

export function currentUserId(): string {
  return storage.getStore()?.userId ?? loadConfig().appUserId;
}

export function currentAuthContext(): AuthContext {
  return storage.getStore() ?? { userId: loadConfig().appUserId };
}

export function currentUserRole(): "OWNER" | "USER" {
  return currentAuthContext().role ?? (currentUserId() === loadConfig().appUserId ? "OWNER" : "USER");
}

export function serverAuthContext(token: string): AuthContext | null {
  const context = authContextForToken(token);
  if (context) return context;
  return localAuthBypassAllowed() ? { userId: loadConfig().appUserId } : null;
}

/** Resolves database sessions for server components while retaining legacy token support. */
export async function serverAuthContextAsync(token: string): Promise<AuthContext | null> {
  const legacy = serverAuthContext(token);
  if (legacy) return legacy;
  const session = await resolveSession(token);
  return session ? { userId: session.id, role: session.role, email: session.email } : null;
}

export function authenticate(req: Request): { context?: AuthContext; error?: { status: number; message: string } } {
  const config = loadConfig();
  const context = serverAuthContext(tokenFromRequest(req));
  if (context) return { context };
  if (!config.appAccessToken && !process.env.APP_USERS_JSON) {
    return { error: { status: 503, message: "Authentication is not configured" } };
  }
  return { error: { status: 401, message: "Unauthorized" } };
}

export async function authenticateAsync(req: Request): Promise<{ context?: AuthContext; error?: { status: number; message: string } }> {
  const config = loadConfig();
  const context = await serverAuthContextAsync(tokenFromRequest(req));
  if (context) return { context };
  if (!config.appAccessToken && !process.env.APP_USERS_JSON && !process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
    return { error: { status: 503, message: "Authentication is not configured" } };
  }
  return { error: { status: 401, message: "Unauthorized" } };
}
