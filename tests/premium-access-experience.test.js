const assert = require("node:assert");
const request = require("supertest");
const app = require("../server");

describe("premium access experience", () => {
  it("keeps infrastructure implementation language out of the public login experience", async () => {
    const response = await request(app).get("/login").set("Accept", "text/html");
    assert.equal(response.status, 200);
    assert.match(response.text, /Continue your work\./);
    assert.match(response.text, /Login with email/);
    assert.match(response.text, /One connected workspace/);
    assert.match(response.text, /Private by default/);
    assert.doesNotMatch(response.text, /sessions are configured/i);
    assert.doesNotMatch(response.text, /server-side authorization/i);
    assert.doesNotMatch(response.text, /service-role|webhook secret|environment variable/i);
    assert.match(response.text, /sonara-premium-access-2027\.css\?v=premium-access-20260720/);
  });

  it("protects product workspaces and founder routes when no valid session exists", async () => {
    for (const route of ["/dashboard", "/business-builder/dashboard", "/creator-studio/dashboard", "/growth-studio/dashboard", "/admin"]) {
      const response = await request(app).get(route).set("Accept", "text/html");
      assert.notEqual(response.status, 200, `${route} unexpectedly rendered without authorization`);
      assert.ok([302, 303, 401, 403].includes(response.status), `${route} returned unexpected status ${response.status}`);
    }
  });

  it("keeps organization creation authorization-gated", async () => {
    const response = await request(app)
      .post("/account/setup/organization")
      .type("form")
      .send({ organizationName: "Unauthorized Test", productPath: "business-builder" });
    assert.ok([302, 303, 401, 403].includes(response.status));
  });

  it("applies production security headers without exposing implementation data", async () => {
    const response = await request(app).get("/");
    assert.equal(response.status, 200);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["referrer-policy"], "strict-origin-when-cross-origin");
    assert.match(response.headers["permissions-policy"], /camera=\(\)/);
    assert.match(response.headers["content-security-policy"], /frame-ancestors 'none'/);
    assert.match(response.headers["content-security-policy"], /object-src 'none'/);
    assert.match(response.headers["content-security-policy"], /fonts\.googleapis\.com/);
  });

  it("serves the lightweight premium access stylesheet", async () => {
    const response = await request(app).get("/sonara-premium-access-2027.css");
    assert.equal(response.status, 200);
    assert.match(response.text, /prefers-reduced-motion/);
    assert.match(response.text, /sonara-premium-float/);
    assert.doesNotMatch(response.text, /three\.js|webgl|canvas/i);
  });
});
