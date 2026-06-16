const request = require("supertest");
const assert = require("assert");
const app = require("../server");

describe("GET /", () => {
  it("responds with the SONARA Industries homepage", async function() {
    const res = await request(app)
      .get("/")
      .set("Accept", "text/html");

    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /LAUNCH OPERATING SYSTEM/);
    assert.match(res.text, /SONARA Industries/);
    assert.match(res.text, /Request launch review/);
    assert.match(res.text, /View pricing/);
    assert.match(res.text, /Security posture/);
    assert.match(res.text, /Business Builder/);
    assert.match(res.text, /Creator Studio/);
    assert.match(res.text, /Growth Studio/);
    assert.doesNotMatch(res.text, /Express service is online/);
  });
});

describe("GET /api/health", () => {
  it("responds with JSON health status", async function() {
    const res = await request(app)
      .get("/api/health")
      .set("Accept", "application/json");

    assert.equal(res.status, 200);
    assert.equal(res.type, "application/json");
    assert.deepEqual(res.body, { ok: true });
  });
});

describe("GET /api/readiness", () => {
  it("responds with non-secret readiness flags", async function() {
    const res = await request(app)
      .get("/api/readiness")
      .set("Accept", "application/json");

    assert.equal(res.status, 200);
    assert.equal(res.type, "application/json");
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.services.supabase.ready, "boolean");
    assert.equal(typeof res.body.services.stripe.ready, "boolean");
    assert.equal(typeof res.body.services.resend.ready, "boolean");
    assert.equal(typeof res.body.services.googleOAuth.ready, "boolean");
    assert.equal(res.text.includes("SUPABASE_SERVICE_ROLE_KEY="), false);
  });
});

describe("GET /contact", () => {
  it("responds with the contact page", async function() {
    const res = await request(app)
      .get("/contact")
      .set("Accept", "text/html");

    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /Contact SONARA Industries/);
  });
});

describe("POST /contact", () => {
  it("returns a safe reference when email is not configured", async function() {
    const res = await request(app)
      .post("/contact")
      .type("form")
      .send({
        category: "contact",
        email: "launch@example.com",
        message: "Please review the paid launch readiness path.",
        consent: "yes"
      });

    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /Reference ID:/);
  });
});

describe("GET /pricing", () => {
  it("responds with the pricing page", async function() {
    const res = await request(app)
      .get("/pricing")
      .set("Accept", "text/html");

    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /Pricing/);
    assert.match(res.text, /Checkout is blocked until live Stripe server variables are configured/);
  });
});

describe("POST /api/checkout/session", () => {
  it("returns setup_required when Stripe is not configured", async function() {
    const res = await request(app)
      .post("/api/checkout/session")
      .send({ plan: "starter_monthly" })
      .set("Accept", "application/json");

    assert.equal(res.status, 503);
    assert.equal(res.type, "application/json");
    assert.equal(res.body.code, "setup_required");
  });
});

describe("GET /legal/terms", () => {
  it("responds with complete legal terms", async function() {
    const res = await request(app)
      .get("/legal/terms")
      .set("Accept", "text/html");

    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /Terms of Service/);
    assert.doesNotMatch(res.text, /\[To be added\]/);
  });
});

describe("GET /admin", () => {
  it("requires protection", async function() {
    const res = await request(app)
      .get("/admin")
      .set("Accept", "application/json");

    assert.ok([401, 503].includes(res.status));
    assert.match(res.text, /admin_auth_required|setup_required/);
  });
});

describe("GET /unknown-route", () => {
  it("responds with a 404", async function() {
    const res = await request(app)
      .get("/unknown-route")
      .set("Accept", "application/json");

    assert.equal(res.status, 404);
    assert.equal(res.type, "application/json");
    assert.equal(res.body.error, "not_found");
  });
});
