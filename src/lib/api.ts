import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { loadConfig } from "@/domain/config";
import { log } from "./logger";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, init);
}

export function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

/** Wrap a route handler with structured logging + typed error mapping. */
export function withApi<Ctx = unknown>(
  name: string,
  handler: (req: Request, ctx: Ctx) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const started = Date.now();
    try {
      const authFailure = checkAuth(req);
      if (authFailure) return authFailure;
      const res = await handler(req, ctx);
      log.info("api.request", { route: name, status: res.status, ms: Date.now() - started });
      return res;
    } catch (err) {
      if (err instanceof ZodError) {
        log.warn("api.validation_error", { route: name, issues: err.issues });
        return jsonError(422, "Validation failed", err.issues);
      }
      const message = err instanceof Error ? err.message : String(err);
      log.error("api.error", { route: name, message, ms: Date.now() - started });
      return jsonError(500, message);
    }
  };
}

/** Optional bearer-token gate. Disabled when APP_ACCESS_TOKEN is unset. */
export function checkAuth(req: Request): Response | null {
  const token = loadConfig().appAccessToken;
  if (!token) return null; // local single-user mode
  const provided = req.headers.get("authorization") ?? "";
  if (provided === `Bearer ${token}`) return null;
  return jsonError(401, "Unauthorized");
}
