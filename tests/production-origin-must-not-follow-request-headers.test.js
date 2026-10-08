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
        getEnv: () => "sk_test_placeholder",
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
      assert.equal(calls.filter((url) => url.includes("/v1/checkout/sessions")).length, 0);
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

});
