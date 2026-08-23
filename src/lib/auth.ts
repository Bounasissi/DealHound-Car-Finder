import { AsyncLocalStorage } from "node:async_hooks";
import { loadConfig } from "@/domain/config";
import { authContextForToken, localAuthBypassAllowed, tokenFromRequest, type AuthContext } from "./auth-token";

export type { AuthContext } from "./auth-token";

const storage = new AsyncLocalStorage<AuthContext>();

export function runWithAuth<T>(context: AuthContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn);
}

export function currentUserId(): string {
  return storage.getStore()?.userId ?? loadConfig().appUserId;
}

export function serverAuthContext(token: string): AuthContext | null {
  const context = authContextForToken(token);
  if (context) return context;
  return localAuthBypassAllowed() ? { userId: loadConfig().appUserId } : null;
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
