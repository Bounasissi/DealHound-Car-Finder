import { loadConfig } from "@/domain/config";

export const AUTH_COOKIE = "dealhound_auth";

export interface AuthContext {
  userId: string;
}

function configuredUsers(): Map<string, string> {
  const config = loadConfig();
  const users = new Map<string, string>();
  if (config.appAccessToken) users.set(config.appAccessToken, config.appUserId);
  const raw = process.env.APP_USERS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      for (const [token, userId] of Object.entries(parsed)) {
        if (token && userId) users.set(token, userId);
      }
    } catch {
      throw new Error("APP_USERS_JSON must be a JSON object mapping bearer tokens to user ids");
    }
  }
  return users;
}

export function authContextForToken(token: string): AuthContext | null {
  if (!token) return null;
  const userId = configuredUsers().get(token);
  return userId ? { userId } : null;
}

export function tokenFromRequest(req: Request): string {
  const authorization = req.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return bearer;

  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${AUTH_COOKIE}=`));
  if (!cookie) return "";
  try {
    return decodeURIComponent(cookie.slice(AUTH_COOKIE.length + 1));
  } catch {
    return "";
  }
}

export function localAuthBypassAllowed(): boolean {
  const config = loadConfig();
  return config.allowUnauthenticatedLocal && process.env.NODE_ENV !== "production";
}
