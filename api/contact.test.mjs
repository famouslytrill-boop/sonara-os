import { Readable } from "node:stream";
import { Buffer } from "node:buffer";
import { URLSearchParams } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./contact.js";

const originalEnv = process.env;
const originalFetch = globalThis.fetch;

describe("contact API launch behavior", () => {
  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requires server-side Supabase storage before accepting a valid request", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: ""
    };
    const { req, res } = createRequest({
      email: "customer@example.com",
      category: "contact",
      message: "Please help me launch.",
      consent: "yes"
    });

    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body)).toMatchObject({
      error: "support_storage_unavailable"
    });
  });

  it("saves the contact request and marks email_sent when Resend succeeds", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
      RESEND_API_KEY: "resend-placeholder",
      RESEND_FROM_EMAIL: "support@example.com",
      SUPPORT_EMAIL: "support@example.com"
    };
    const calls = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("/rest/v1/support_requests") && init?.method === "POST") {
        return jsonResponse([{ id: "support-row-1" }]);
      }
      if (String(url).includes("api.resend.com")) {
        return jsonResponse({ id: "email-1" });
      }
      return jsonResponse({});
    });

    const { req, res } = createRequest({
      email: "customer@example.com",
      category: "support",
      message: "Please check my launch setup.",
      consent: "yes"
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      ok: true,
      emailDeliveryStatus: "email_sent"
    });
    expect(calls.some((call) => call.url.includes("/rest/v1/support_requests"))).toBe(true);
    expect(calls.some((call) => call.url.includes("api.resend.com"))).toBe(true);
  });

  it("keeps the request accepted when Resend fails after DB save", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
      RESEND_API_KEY: "resend-placeholder",
      RESEND_FROM_EMAIL: "support@example.com",
      SUPPORT_EMAIL: "support@example.com"
    };
    globalThis.fetch = vi.fn(async (url, init) => {
      if (String(url).includes("/rest/v1/support_requests") && init?.method === "POST") {
        return jsonResponse([{ id: "support-row-1" }]);
      }
      if (String(url).includes("api.resend.com")) {
        return jsonResponse({ error: "provider down" }, 503);
      }
      return jsonResponse({});
    });

    const { req, res } = createRequest({
      email: "customer@example.com",
      category: "feedback",
      message: "Email can fail but the row must stay saved.",
      consent: "yes"
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      ok: true,
      emailDeliveryStatus: "email_failed"
    });
  });
});

function createRequest(body) {
  const req = Readable.from([Buffer.from(new URLSearchParams(body).toString())]);
  req.method = "POST";
  req.headers = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json"
  };
  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    end(value = "") {
      this.body = String(value);
    }
  };
  return { req, res };
}

function jsonResponse(payload, status = 200) {
  return new globalThis.Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
