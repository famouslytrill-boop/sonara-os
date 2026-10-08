// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { createRateLimiter, __resetInMemoryBucketsForTests } = require("../lib/sonara-rate-limit.cjs");

describe("durable-only security budgets", () => {
  beforeEach(() => __resetInMemoryBucketsForTests());

  function buildLimiterApp(options = {}) {
    const app = express();
    app.use(express.json());
    let sideEffects = 0;
    app.post("/send",
      createRateLimiter({
        name: "durable_only_support_test",
        windowSeconds: 60,
        maxAttempts: 5,
        requireDurable: true,
        getSupabaseServerConfig: () => ({ ok: false }),
        ...options
      }),
      (req, res) => {
        sideEffects += 1;
        return res.status(200).json({ ok: true });
      }
    );
    return { app, getSideEffects: () => sideEffects };
  }

  it("rejects sending when a durable counter is not configured", async () => {
    const { app, getSideEffects } = buildLimiterApp();
    const response = await request(app).post("/send").send({ email: "person@example.com" });
    assert.equal(response.status, 503);
    assert.equal(response.body.code, "rate_limit_unavailable");
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.headers["retry-after"], "60");
    assert.equal(getSideEffects(), 0, "a missing counter must never reach a provider");
  });

  it("uses an accessible HTML outage message when supplied", async () => {
    const { app } = buildLimiterApp({
      renderUnavailable: ({ req, res }) => {
        if (req.get("accept") !== "text/html") return false;
        return res.status(503).type("html").send("<p>Support is temporarily unavailable.</p>");
      }
    });
    const response = await request(app).post("/send").set("accept", "text/html");
    assert.equal(response.status, 503);
    assert.match(response.text, /temporarily unavailable/);
  });

  it("preserves developer fallback when durability is not required", async () => {
    const { app, getSideEffects } = buildLimiterApp({ requireDurable: false });
    const response = await request(app).post("/send");
    assert.equal(response.status, 200);
    assert.equal(getSideEffects(), 1);
  });

  it("can activate strict policy dynamically without restarting the app", async () => {
    let strict = false;
    const { app, getSideEffects } = buildLimiterApp({ requireDurable: () => strict });
    const before = await request(app).post("/send");
    strict = true;
    const after = await request(app).post("/send");
    assert.equal(before.status, 200);
    assert.equal(after.status, 503);
    assert.equal(getSideEffects(), 1);
  });

  it("allows a request when the distributed counter authoritatively grants it", async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      assert.match(String(url), /\/rpc\/sonara_consume_rate_limit/);
      return { ok: true, json: async () => ({ allowed: true, remaining: 4, retry_after_seconds: 0 }) };
    };
    try {
      const { app, getSideEffects } = buildLimiterApp({
        getSupabaseServerConfig: () => ({
          ok: true, url: "https://staging-project.supabase.co", serviceRoleKey: "synthetic-test-key"
        })
      });
      const response = await request(app).post("/send");
      assert.equal(response.status, 200);
      assert.equal(getSideEffects(), 1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
