"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

describe("Free Launch Stack", () => {
  it("publishes a useful, no-secret research directory", async () => {
    const response = await request(app).get("/free-launch-stack");
    assert.equal(response.status, 200);
    assert.match(response.text, /Vercel/);
    assert.match(response.text, /Hosted data service/);
    assert.match(response.text, /Deterministic workflows/);
    assert.match(response.text, /sonara-free-launch-stack\.js/);
    assert.doesNotMatch(response.text, /(?:API_KEY|SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY)/);
  });

  it("offers the same safe directory data to application clients", async () => {
    const response = await request(app).get("/api/free-launch-stack").set("Accept", "application/json");
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.status, "research_directory");
    assert.ok(response.body.itemCount >= 10);
    assert.ok(response.body.items.some((item) => item.key === "database-hosted-data-service"));
    assert.doesNotMatch(response.text, /(?:API_KEY|SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY)/);
  });
});
