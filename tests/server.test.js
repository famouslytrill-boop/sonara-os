const request = require("supertest");
const assert = require("assert");
const app = require("../server");

describe("GET /", () => {
  it("responds with the Express landing page", async function() {
    const res = await request(app)
      .get("/")
      .set("Accept", "text/html");

    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /Express service is online/);
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
