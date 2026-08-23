import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { log } from "./logger";
import { authenticate, runWithAuth } from "./auth";

const requestWindows = new Map<string, { startedAt: number; count: number }>();

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
      const auth = authenticate(req);
      if (auth.error) return jsonError(auth.error.status, auth.error.message);
      const rateKey = auth.context!.userId;
      const now = Date.now();
      const window = requestWindows.get(rateKey);
      const limit = loadRateLimit();
      if (!window || now - window.startedAt >= 60_000) requestWindows.set(rateKey, { startedAt: now, count: 1 });
      else if (++window.count > limit) return jsonError(429, "Rate limit exceeded", { retryAfterSeconds: 60 });
      const res = await runWithAuth(auth.context!, () => handler(req, ctx));
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

function loadRateLimit(): number {
  const value = Number(process.env.API_RATE_LIMIT_PER_MINUTE ?? "120");
  return Number.isFinite(value) && value > 0 ? value : 120;
}

/** Compatibility wrapper for callers that only need an auth response. */
export function checkAuth(req: Request): Response | null {
  const auth = authenticate(req);
  return auth.error ? jsonError(auth.error.status, auth.error.message) : null;
}
