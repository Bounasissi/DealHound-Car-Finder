import { afterEach, describe, expect, it } from "vitest";
import { authenticate, serverAuthContext } from "@/lib/auth";
import { secureCookieForRequest } from "@/lib/auth-token";

const originalEnv = {
  appAccessToken: process.env.APP_ACCESS_TOKEN,
  appUserId: process.env.APP_USER_ID,
  appUsersJson: process.env.APP_USERS_JSON,
  allowUnauthenticatedLocal: process.env.ALLOW_UNAUTHENTICATED_LOCAL,
};

afterEach(() => {
  process.env.APP_ACCESS_TOKEN = originalEnv.appAccessToken;
  process.env.APP_USER_ID = originalEnv.appUserId;
  process.env.APP_USERS_JSON = originalEnv.appUsersJson;
  process.env.ALLOW_UNAUTHENTICATED_LOCAL = originalEnv.allowUnauthenticatedLocal;
});

describe("request authentication", () => {
  it("only marks browser cookies secure when the request is HTTPS", () => {
    expect(secureCookieForRequest(new Request("http://localhost/api/auth/session"))).toBe(false);
    expect(secureCookieForRequest(new Request("https://dealhound.example/api/auth/session"))).toBe(true);
    expect(secureCookieForRequest(new Request("http://proxy/api/auth/session", { headers: { "x-forwarded-proto": "https" } }))).toBe(true);
  });

  it("resolves the browser session to its configured owner for server rendering", () => {
    process.env.APP_ACCESS_TOKEN = "primary-token";
    process.env.APP_USER_ID = "primary-user";
    process.env.APP_USERS_JSON = JSON.stringify({ "secondary-token": "secondary-user" });
    process.env.ALLOW_UNAUTHENTICATED_LOCAL = "false";

    expect(serverAuthContext("secondary-token")).toEqual({ userId: "secondary-user" });
    expect(serverAuthContext("unknown-token")).toBeNull();
  });

  it("accepts a configured token from the browser session cookie", () => {
    process.env.APP_ACCESS_TOKEN = "session-token";
    process.env.APP_USER_ID = "user-1";
    process.env.APP_USERS_JSON = "";
    process.env.ALLOW_UNAUTHENTICATED_LOCAL = "false";

    const result = authenticate(new Request("http://localhost/api/listings", {
      headers: { cookie: "dealhound_auth=session-token" },
    }));

    expect(result).toEqual({ context: { userId: "user-1" } });
  });

  it("keeps invalid browser cookies rejected when production auth is enabled", () => {
    process.env.APP_ACCESS_TOKEN = "session-token";
    process.env.APP_USERS_JSON = "";
    process.env.ALLOW_UNAUTHENTICATED_LOCAL = "false";

    const result = authenticate(new Request("http://localhost/api/listings", {
      headers: { cookie: "dealhound_auth=wrong-token" },
    }));

    expect(result.error).toEqual({ status: 401, message: "Unauthorized" });
  });
});
