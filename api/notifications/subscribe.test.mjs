import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./subscribe.js";

const originalEnv = process.env;
const originalFetch = globalThis.fetch;

describe("notification subscription API", () => {
  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requires an authenticated Supabase user", async () => {
    process.env = { ...originalEnv, NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" };
    const response = createResponse();
    await handler(createRequest({}, {}), response);
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).error).toBe("missing_auth_token");
  });

  it("verifies the user and stores a valid subscription server-side", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-placeholder",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder"
    };
    const calls = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/auth/v1/user")) {
        return jsonResponse({ id: "00000000-0000-4000-8000-000000000001" });
      }
      return jsonResponse({}, 201);
    });
    const response = createResponse();
    await handler(
      createRequest(
        { authorization: "Bearer user-token" },
        {
          subscription: {
            endpoint: "https://push.example.test/subscription",
            keys: { p256dh: "public-key", auth: "auth-key" }
          },
          userAgent: "test-browser"
        }
      ),
      response
    );
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ ok: true, status: "registered" });
    expect(calls[1].url).toContain("/rest/v1/push_notification_subscriptions");
    expect(calls[1].init.headers.Authorization).toBe("Bearer service-role-placeholder");
    expect(calls[1].init.body).toContain('"user_id":"00000000-0000-4000-8000-000000000001"');
  });
});

function createRequest(headers, body) {
  const request = Readable.from([JSON.stringify(body)]);
  request.headers = { "content-type": "application/json", ...headers };
  request.method = "POST";
  return request;
}

function createResponse() {
  return { statusCode: 200, headers: {}, body: "", setHeader(name, value) { this.headers[name] = value; }, end(value) { this.body = value; } };
}

function jsonResponse(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return payload; } };
}
