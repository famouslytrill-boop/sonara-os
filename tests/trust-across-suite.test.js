// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const { TRUST_DESTINATIONS } = require("../lib/sonara-trust-navigation.cjs");
const { contactForm } = require("../lib/sonara-shell.cjs");

// The shared page shell renders each company; this deliberately exercises
// actual HTTP surfaces instead of checking for links only in source code.
const PAGES = [
  "/", "/about", "/business-builder", "/creator-studio", "/growth-studio",
  "/help", "/contact", "/support", "/security", "/tutorials",
  "/tutorials/getting-started", "/tutorials/business-builder",
  "/tutorials/creator-studio", "/tutorials/growth-studio"
];

describe("trust and customer guidance across all SONARA companies", function () {
  this.timeout(30000);

  it("publishes one canonical accessible footer navigation on parent and studio pages", async () => {
    assert.ok(TRUST_DESTINATIONS.length >= 7);
    assert.equal(new Set(TRUST_DESTINATIONS.map((x) => x.href)).size, TRUST_DESTINATIONS.length);
    for (const path of PAGES) {
      const response = await request(app).get(path).set("Accept", "text/html");
      assert.equal(response.status, 200, `${path} must be reachable`);
      const html = response.text || "";
      const footer = html.match(/<footer>([\s\S]*?)<\/footer>/)?.[1] || "";
      assert.ok(footer, `${path} is missing the common footer`);
      const trust = footer.match(/<nav aria-label="Help and company information">([\s\S]*?)<\/nav>/)?.[1] || "";
      assert.ok(trust, `${path} does not inherit the trust navigation`);
      for (const { href, label } of TRUST_DESTINATIONS) {
        assert.ok(trust.includes(`href="${href}"`), `${path} missing ${label} (${href})`);
        assert.ok(trust.includes(`>${label}</a>`), `${path} missing accessible label for ${href}`);
      }
      assert.match(footer, /<nav aria-label="Legal">/);
      assert.match(footer, /href="\/legal\/terms"/);
      assert.match(footer, /href="\/legal\/privacy"/);
    }
  });

  it("gives all four tutorials recovery, account-security and privacy paths", async () => {
    for (const path of PAGES.filter((p) => p.startsWith("/tutorials/"))) {
      const response = await request(app).get(path).set("Accept", "text/html");
      assert.equal(response.status, 200);
      for (const href of ["/help", "/contact", "/account/security", "/privacy"]) {
        assert.ok(response.text.includes(`href="${href}"`), `${path} missing tutorial action ${href}`);
      }
      assert.match(response.text, /Step 1/);
    }
  });

  it("renders the same bounded, privacy-aware input contract for contact and support", async () => {
    for (const [path,action] of [["/contact","/contact"],["/support","/support/request"]]) {
      const response = await request(app).get(path);
      assert.equal(response.status, 200);
      assert.ok(response.text.includes(`action="${action}"`));
      assert.ok(response.text.includes('maxlength="120"'));
      assert.ok(response.text.includes('maxlength="254"'));
      assert.ok(response.text.includes('maxlength="160"'));
      assert.ok(response.text.includes('maxlength="4000"'));
      assert.ok(response.text.includes('name="website"'));
      assert.ok(response.text.includes("Do not include passwords"));
      assert.ok(response.text.includes('<label for="contact-category">Request type</label>'));
    }
    assert.throws(() => contactForm({}, "", { action: "https://evil.example/support" }), TypeError);
  });

  it("rejects overlong and malformed public requests before storing or sending them", async () => {
    const base = {
      name: "Example Customer", email: "customer@example.com", subject: "Help needed",
      category: "support", message: "This is a valid support request.", consent: "yes"
    };
    for (const path of ["/contact","/support/request"]) {
      for (const [key, value] of [
        ["name", "A".repeat(121)],
        ["subject", "B".repeat(161)],
        ["email", "c".repeat(246) + "@example.com"],
        ["subject", "A\r\nB"],
        ["message", "M".repeat(4001)]
      ]) {
        const response = await request(app).post(path).set("Accept", "application/json").send({ ...base, [key]: value });
        assert.equal(response.status, 400, `${path} accepted ${key} beyond the safe contract`);
        assert.equal(response.body.code, "validation_failed");
      }
    }
  });
  it("denies both POST routes before database writes or email when the durable budget says no", async () => {
    const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
    const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    const originalFetch = global.fetch;
    const calls = [];
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_support_budget_key_1234567890";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_support_budget_key_1234567890";
    global.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes("/rpc/sonara_consume_rate_limit")) {
        return { ok: true, json: async () => [{ allowed: false, remaining: 0, retry_after_seconds: 3600 }] };
      }
      throw new Error("a rate-limited request reached downstream services");
    };
    const base = {
      name: "Example Customer", email: "customer@example.com", subject: "Help needed",
      category: "support", message: "This is a valid support request.", consent: "yes"
    };
    try {
      for (const route of ["/contact", "/support/request"]) {
        const response = await request(app).post(route).set("Accept", "application/json").send(base);
        assert.equal(response.status, 429, `${route} bypassed the durable budget`);
        assert.equal(response.body.code, "rate_limited");
        assert.match(response.headers["retry-after"] || "", /^\d+$/);
      }
      assert.ok(calls.length >= 2 && calls.every((url) => url.includes("/rpc/sonara_consume_rate_limit")));
    } finally {
      global.fetch = originalFetch;
      for (const [key,value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("fails both public support routes closed in production if durable limits cannot be configured", async () => {
    const keys = ["NODE_ENV", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
    const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    const base = {
      name: "Example Customer", email: "customer@example.com", subject: "Help needed",
      category: "support", message: "This is a valid support request.", consent: "yes"
    };
    try {
      process.env.NODE_ENV = "production";
      for (const key of keys.filter((x) => x !== "NODE_ENV")) delete process.env[key];
      for (const path of ["/contact", "/support/request"]) {
        const response = await request(app).post(path).set("Accept", "application/json").send(base);
        assert.equal(response.status, 503, `${path} must not send email without a distributed limiter`);
        assert.equal(response.body.code, "rate_limit_unavailable");
        assert.match(response.body.message, /No request was recorded or sent/);
      }
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

});
