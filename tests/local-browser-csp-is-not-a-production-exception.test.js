"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

describe("strict CSP with HTTP loopback-only browser fixtures", () => {
  let previous;
  before(() => { previous = process.env.NODE_ENV; });
  after(() => { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; });

  it("keeps the anti-injection and outbound controls in isolated browser tests", async () => {
    process.env.NODE_ENV = "test";
    const result = await request(app).get("/").set("Host", "127.0.0.1:3000");
    assert.equal(result.status, 200);
    const policy = result.headers["content-security-policy"];
    assert.match(policy, /script-src 'self'/);
    assert.match(policy, /connect-src 'self' https:\/\/\*\.supabase\.co https:\/\/api\.stripe\.com/);
    assert.match(policy, /frame-ancestors 'none'/);
    assert.doesNotMatch(policy, /upgrade-insecure-requests/);
  });

  it("does not exempt an arbitrary hostname even with NODE_ENV=test", async () => {
    process.env.NODE_ENV = "test";
    const result = await request(app).get("/").set("Host", "example.com");
    assert.equal(result.status, 200);
    assert.match(result.headers["content-security-policy"], /; upgrade-insecure-requests$/);
  });

  it("preserves the production upgrade directive even on loopback", async () => {
    process.env.NODE_ENV = "production";
    const result = await request(app).get("/").set("Host", "127.0.0.1:3000");
    assert.equal(result.status, 200);
    assert.match(result.headers["content-security-policy"], /; upgrade-insecure-requests$/);
  });
});
