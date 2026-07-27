"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const {
  createRateLimiter,
  getClientIdentifier,
  hashIdentifier,
  __resetInMemoryBucketsForTests
} = require("../lib/sonara-rate-limit.cjs");

// These exercise the in-memory path (no Supabase configured), which is what
// runs in tests and local development. The durable Postgres path is covered by
// the self-verifying assertions inside 20260727171000_phase0_auth_rate_limits.sql.
describe("authentication rate limiting", () => {
  beforeEach(() => {
    __resetInMemoryBucketsForTests();
  });

  function buildApp(limiterOptions) {
    const app = express();
    app.use(express.json());
    app.post(
      "/try",
      createRateLimiter({ name: "test", windowSeconds: 60, maxAttempts: 3, ...limiterOptions }),
      (req, res) => res.status(200).json({ ok: true })
    );
    return app;
  }

  it("allows requests up to the ceiling and denies the next one", async () => {
    const app = buildApp({});

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const allowed = await request(app).post("/try").set("x-forwarded-for", "203.0.113.10");
      assert.equal(allowed.status, 200, `attempt ${attempt + 1} should be allowed`);
    }

    const denied = await request(app).post("/try").set("x-forwarded-for", "203.0.113.10");
    assert.equal(denied.status, 429);
    assert.equal(denied.body.code, "rate_limited");
    assert.ok(Number(denied.headers["retry-after"]) >= 1, "must send a positive Retry-After");
  });

  it("keeps budgets separate per client address", async () => {
    const app = buildApp({});

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app).post("/try").set("x-forwarded-for", "203.0.113.10");
    }

    const other = await request(app).post("/try").set("x-forwarded-for", "203.0.113.99");
    assert.equal(other.status, 200, "a different address must have its own budget");
  });

  it("limits by subject so one account cannot be attacked from many addresses", async () => {
    const app = buildApp({ scopes: ["subject"], subjectFrom: (req) => req.body?.email });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const allowed = await request(app)
        .post("/try")
        .set("x-forwarded-for", `198.51.100.${attempt}`)
        .send({ email: "target@example.com" });
      assert.equal(allowed.status, 200);
    }

    const denied = await request(app)
      .post("/try")
      .set("x-forwarded-for", "198.51.100.250")
      .send({ email: "target@example.com" });
    assert.equal(denied.status, 429, "a rotating botnet must still exhaust the account budget");

    const untouched = await request(app)
      .post("/try")
      .set("x-forwarded-for", "198.51.100.250")
      .send({ email: "someone-else@example.com" });
    assert.equal(untouched.status, 200, "an unrelated account must be unaffected");
  });

  it("treats subject identifiers case-insensitively", async () => {
    const app = buildApp({ scopes: ["subject"], subjectFrom: (req) => req.body?.email });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app).post("/try").send({ email: "Target@Example.com" });
    }

    const denied = await request(app).post("/try").send({ email: "target@example.com" });
    assert.equal(denied.status, 429, "casing must not create a fresh budget");
  });

  it("answers HTML form posts with a page when renderDenied is supplied", async () => {
    const app = buildApp({
      renderDenied: ({ req, res, retryAfterSeconds }) => {
        if (!String(req.headers.accept || "").includes("text/html")) return false;
        return res.status(429).type("html").send(`<p>wait ${retryAfterSeconds}s</p>`);
      }
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app).post("/try").set("x-forwarded-for", "203.0.113.7");
    }

    const denied = await request(app)
      .post("/try")
      .set("x-forwarded-for", "203.0.113.7")
      .set("accept", "text/html");
    assert.equal(denied.status, 429);
    assert.match(denied.text, /wait \d+s/);
  });

  it("does not send a raw address or email to the counter store", () => {
    const hashed = hashIdentifier("target@example.com");
    assert.doesNotMatch(hashed, /target|example/i);
    assert.equal(hashed.length, 32);
  });

  it("prefers the edge-recorded client address over later proxy hops", () => {
    const identifier = getClientIdentifier({
      headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178" }
    });
    assert.equal(identifier, "203.0.113.5");
  });

  it("fails open when the counter store is unavailable", async () => {
    const degraded = [];
    const app = express();
    app.use(express.json());
    app.post(
      "/try",
      createRateLimiter({
        name: "test",
        windowSeconds: 60,
        maxAttempts: 1,
        // Report configured so the durable path is attempted, then point it at
        // an address that cannot resolve.
        getSupabaseServerConfig: () => ({
          ok: true,
          url: "http://127.0.0.1:1",
          serviceRoleKey: "test-key"
        }),
        onDegraded: (event) => degraded.push(event)
      }),
      (req, res) => res.status(200).json({ ok: true })
    );

    const first = await request(app).post("/try");
    const second = await request(app).post("/try");

    assert.equal(first.status, 200);
    assert.equal(second.status, 200, "an unreachable store must not lock users out");
    assert.ok(degraded.length >= 2, "the degraded condition must be reported, not silent");
  });
});

describe("authentication routes carry rate limiters", () => {
  it("registers a limiter in front of each credential endpoint", () => {
    const app = require("../server");

    const protectedPaths = new Map([
      ["/auth/login", "post"],
      ["/auth/signup", "post"],
      ["/admin/login", "post"],
      ["/auth/forgot-password", "post"],
      ["/auth/reset-password", "post"],
      ["/business-builder/invite/accept", "post"]
    ]);

    for (const [routePath, method] of protectedPaths) {
      const layer = app._router.stack.find(
        (entry) => entry.route?.path === routePath && entry.route?.methods?.[method]
      );
      assert.ok(layer, `${method.toUpperCase()} ${routePath} should be registered`);

      const handlerNames = layer.route.stack.map((entry) => entry.name);
      assert.ok(
        handlerNames.includes("rateLimitMiddleware"),
        `${method.toUpperCase()} ${routePath} must sit behind a rate limiter (got ${handlerNames.join(", ")})`
      );
    }
  });
});
