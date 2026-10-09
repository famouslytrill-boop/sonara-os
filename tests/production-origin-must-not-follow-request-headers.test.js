// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { siteOrigin } = require("../lib/sonara-site-origin.cjs");

function withNodeEnv(environment, run) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = environment;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

const forgedRequest = {
  protocol: "https",
  get(name) {
    return {
      host: "attacker.example",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "https"
    }[name.toLowerCase()] || "";
  }
};

describe("canonical SONARA origin for all company products", () => {
  it("never builds production OAuth, checkout, invite, or share URLs from attacker-controlled host headers", () => {
    withNodeEnv("production", () => {
      assert.equal(siteOrigin(forgedRequest, () => ""), "");
      assert.equal(siteOrigin(forgedRequest, () => "http://sonaraindustries.com"), "");
      assert.equal(siteOrigin(forgedRequest, () => "https://sonaraindustries.com/"), "https://sonaraindustries.com");
      assert.equal(siteOrigin(forgedRequest, () => "https://sonaraindustries.com:443/"), "https://sonaraindustries.com");
    });
  });

  it("rejects malformed canonical URLs rather than putting credentials, paths, or redirects in external links", () => {
    withNodeEnv("production", () => {
      for (const bad of [
        "https://user:pass@sonaraindustries.com",
        "https://sonaraindustries.com/account",
        "https://sonaraindustries.com/?next=https://attacker.example",
        "https://sonaraindustries.com/#fragment",
        "javascript:alert(1)",
        "//attacker.example",
        "https://"
      ]) {
        assert.equal(siteOrigin(forgedRequest, () => bad), "", bad);
      }
    });
  });

  it("allows validated local-development hostnames without honoring forwarded hosts", () => {
    withNodeEnv("test", () => {
      const local = {
        protocol: "http",
        get(name) {
          return name === "host" ? "localhost:5000" : "attacker.example";
        }
      };
      assert.equal(siteOrigin(local, () => ""), "http://localhost:5000");
      assert.equal(siteOrigin({ ...local, protocol: "javascript" }, () => ""), "");
      assert.equal(siteOrigin({ ...local, get: () => "evil.example/path" }, () => ""), "");
      assert.equal(siteOrigin({ ...local, get: () => "evil.example@trusted.example" }, () => ""), "");
      assert.equal(siteOrigin({ ...local, get: () => "evil.example, trusted.example" }, () => ""), "");
    });
  });

  it("routes subscription and employee invite URL construction through the same helper", () => {
    const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
    const start = server.indexOf("function getPublicAppUrl(req) {");
    const end = server.indexOf("\nfunction getSafeAbsoluteUrl(", start);
    assert.ok(start >= 0 && end > start, "public URL factory is present");
    const factory = server.slice(start, end);
    assert.match(factory, /return siteOrigin\(req, \(\) => configured\)/);
    assert.doesNotMatch(factory, /x-forwarded-(?:host|proto)/i);
    assert.doesNotMatch(factory, /sonaraindustries\.com/);
  });
  it("refuses to create a checkout session before Stripe is called when the site origin is missing", async () => {
    const { createBilling } = require("../lib/sonara-billing.cjs");
    const previousFetch = global.fetch;
    const calls = [];
    global.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes("/v1/prices/")) {
        return { ok: true, json: async () => ({ unit_amount: 2900, active: true, product: { active: true } }) };
      }
      throw new Error("External checkout session creation must never be called");
    };
    try {
      const billing = createBilling({
        STRIPE_PLANS: { workspace_monthly: { name: "One workspace", amountCents: 2900, mode: "subscription" } },
        getEnv: () => "fixture-key-only-not-a-provider-credential",
        getPublicAppUrl: () => "",
        getSafeAbsoluteUrl: (value, fallback) => value || fallback,
        getSupabaseServerConfig: () => ({ ok: false }),
        supabaseHeaders: () => ({}),
        safeCountTable: async () => ({ ok: true, count: 0 }),
        formatMetric: String,
        insertActivityEvent: async () => ({ ok: true })
      });
      const response = await billing.createStripeCheckoutSession(
        { body: { workspace: "business_builder" } }, "workspace_monthly",
        "price_test_123", "org_test", { id: "user_test" }, "cus_test"
      );
      assert.equal(response.ok, false);
      assert.equal(response.code, "site_origin_not_configured");
      assert.equal(calls.length, 0, "untrusted return origin caused a Stripe API request");
    } finally {
      global.fetch = previousFetch;
    }
  });

  it("does not persist or email a bearer employee invitation without a public origin", async () => {
    const { createBusinessEmployeeInvites } = require("../lib/sonara-business-employee-invites.cjs");
    const previousFetch = global.fetch;
    let callCount = 0;
    global.fetch = async () => { callCount += 1; throw new Error("Invite must not be written"); };
    try {
      const invites = createBusinessEmployeeInvites({
        getSupabaseAdminClient: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "test" }),
        supabaseHeaders: () => ({}),
        hashInviteToken: () => "hash",
        getPublicAppUrl: () => "",
        recordAdminAuditEvent: async () => {},
        isSupabaseConfigured: () => true,
        createEmployeeAuthUser: async () => ({ ok: true }),
        splitList: () => [],
        getReadiness: () => ({ services: { emailDelivery: "enabled" } }),
        getEnv: () => "",
        escapeHtml: String
      });
      const organizationId = "a1a1a1a1-0000-4000-8000-00000000001a";
      const workspaceId = "b2b2b2b2-0000-4000-8000-00000000002b";
      const result = await invites.createBusinessEmployeeInvite({
        body: { organizationId, workspaceId, email: "person@example.com", name: "Employee", role: "employee" },
        sonaraUser: { id: "c3c3c3c3-0000-4000-8000-00000000003c" },
        sonaraBusinessMembership: { organization_id: organizationId, workspace_id: workspaceId }
      });
      assert.equal(result.status, 503);
      assert.equal(result.body.code, "site_origin_not_configured");
      assert.equal(callCount, 0);
    } finally {
      global.fetch = previousFetch;
    }
  });

  it("only accepts same-origin HTTPS checkout redirects, even when an override is configured", () => {
    const { createBilling } = require("../lib/sonara-billing.cjs");
    const redirects = (origin, overrides = {}) => createBilling({
      STRIPE_PLANS: {},
      getEnv: (name) => overrides[name] || "",
      getPublicAppUrl: () => origin,
      getSafeAbsoluteUrl: (value, fallback) => value || fallback,
      getSupabaseServerConfig: () => ({ ok: false }),
      supabaseHeaders: () => ({}),
      safeCountTable: async () => ({ ok: true, count: 0 }),
      formatMetric: String,
      insertActivityEvent: async () => ({ ok: true })
    }).getCheckoutRedirectUrls({});

    assert.deepEqual(redirects("https://sonaraindustries.com"), {
      ok: true,
      successUrl: "https://sonaraindustries.com/account",
      cancelUrl: "https://sonaraindustries.com/pricing"
    });
    assert.deepEqual(redirects("https://sonaraindustries.com", {
      STRIPE_SUCCESS_URL: "https://sonaraindustries.com/account?checkout=done",
      STRIPE_CANCEL_URL: "https://sonaraindustries.com/pricing?checkout=cancelled"
    }), {
      ok: true,
      successUrl: "https://sonaraindustries.com/account?checkout=done",
      cancelUrl: "https://sonaraindustries.com/pricing?checkout=cancelled"
    });
    for (const bad of [
      "https://attacker.example/account",
      "http://sonaraindustries.com/account",
      "https://sonaraindustries.com.attacker.example/account",
      "https://user:pass@sonaraindustries.com/account",
      "https://sonaraindustries.com/account#secret",
      "/account",
      "javascript:alert(1)"
    ]) {
      assert.deepEqual(redirects("https://sonaraindustries.com", { STRIPE_SUCCESS_URL: bad }), {
        ok: false, code: "checkout_redirect_untrusted"
      }, bad);
    }
    assert.deepEqual(redirects("https://sonaraindustries.com/other"), {
      ok: false, code: "site_origin_not_configured"
    });
  });

  it("does not call the Stripe price API when a checkout override sends customers off-site", async () => {
    const { createBilling } = require("../lib/sonara-billing.cjs");
    const previousFetch = global.fetch;
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      throw new Error("Stripe must not be contacted");
    };
    try {
      const billing = createBilling({
        STRIPE_PLANS: { workspace_monthly: { mode: "subscription", amountCents: 2900 } },
        getEnv: (name) => name === "STRIPE_SUCCESS_URL" ? "https://attacker.example/paid" : "",
        getPublicAppUrl: () => "https://sonaraindustries.com",
        getSafeAbsoluteUrl: (value, fallback) => value || fallback,
        getSupabaseServerConfig: () => ({ ok: false }),
        supabaseHeaders: () => ({}),
        safeCountTable: async () => ({ ok: true, count: 0 }),
        formatMetric: String,
        insertActivityEvent: async () => ({ ok: true })
      });
      const result = await billing.createStripeCheckoutSession(
        { body: { workspace: "business_builder" } }, "workspace_monthly",
        "price_test", "org_test", { id: "user_test" }, "cus_test"
      );
      assert.equal(result.ok, false);
      assert.equal(result.code, "checkout_redirect_untrusted");
      assert.equal(calls, 0, "a malformed redirect still triggered a Stripe API call");
    } finally {
      global.fetch = previousFetch;
    }
  });

  it("does not trust Host headers on Vercel preview even if NODE_ENV is accidentally unset", () => {
    const previousVercelEnv = process.env.VERCEL_ENV;
    const previousVercel = process.env.VERCEL;
    try {
      delete process.env.VERCEL;
      process.env.VERCEL_ENV = "preview";
      withNodeEnv("", () => assert.equal(siteOrigin(forgedRequest, () => ""), ""));
      delete process.env.VERCEL_ENV;
      process.env.VERCEL = "1";
      withNodeEnv("test", () => assert.equal(siteOrigin(forgedRequest, () => ""), ""));
    } finally {
      if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previousVercelEnv;
      if (previousVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previousVercel;
    }
  });

  it("retains Stripe loopback redirects only for genuine non-hosted local tests", () => {
    const { createBilling } = require("../lib/sonara-billing.cjs");
    const previousVercelEnv = process.env.VERCEL_ENV;
    const previousVercel = process.env.VERCEL;
    function redirects() {
      return createBilling({
        STRIPE_PLANS: {},
        // Billing uses the injected environment reader, not ambient process
        // access. This fixture must expose the production/hosted flags that
        // the local-only origin regression toggles below.
        getEnv: (name) => ["NODE_ENV", "VERCEL_ENV", "VERCEL"].includes(name)
          ? (process.env[name] || "") : "",
        getPublicAppUrl: () => "http://localhost:5000",
        getSafeAbsoluteUrl: (value, fallback) => value || fallback,
        getSupabaseServerConfig: () => ({ ok: false }),
        supabaseHeaders: () => ({}),
        safeCountTable: async () => ({ ok: true, count: 0 }),
        formatMetric: String,
        insertActivityEvent: async () => ({ ok: true })
      }).getCheckoutRedirectUrls({});
    }
    try {
      delete process.env.VERCEL_ENV;
      delete process.env.VERCEL;
      withNodeEnv("test", () => assert.deepEqual(redirects(), {
        ok: true,
        successUrl: "http://localhost:5000/account",
        cancelUrl: "http://localhost:5000/pricing"
      }));
      withNodeEnv("production", () => assert.deepEqual(redirects(), {
        ok: false, code: "site_origin_not_configured"
      }));
      process.env.VERCEL_ENV = "preview";
      withNodeEnv("development", () => assert.deepEqual(redirects(), {
        ok: false, code: "site_origin_not_configured"
      }));
    } finally {
      if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previousVercelEnv;
      if (previousVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previousVercel;
    }
  });

});
