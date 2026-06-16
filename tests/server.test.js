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
