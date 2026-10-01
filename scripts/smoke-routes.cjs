"use strict";

process.env.NODE_ENV = "test";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

const publicRoutes = [
  "/",
  "/products",
  "/free-tools",
  "/how-it-works",
  "/tutorials",
  "/tutorials/getting-started",
  "/forgot-password",
  "/reset-password"
];
const protectedRoutes = [
  "/dashboard",
  "/notifications",
  "/account/preferences",
  "/business-builder/routes",
  "/creator-studio/rights"
];
const mojibake = /Ã.|â(?:€|€™|€œ|€�|€¦|€“|€”|€¢)|Â./;

async function run() {
  for (const route of publicRoutes) {
    const response = await request(app).get(route).set("Accept", "text/html");
    assert.equal(response.status, 200, `${route} should return 200`);
    assert.match(response.headers["content-type"] || "", /html/, `${route} should return HTML`);
    assert.doesNotMatch(response.text, mojibake, `${route} contains mojibake`);
  }

  const sitemap = await request(app).get("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers["content-type"] || "", /xml/);
  assert.match(sitemap.text, /https:\/\/sonaraindustries\.com\/products/);
  assert.doesNotMatch(sitemap.text, /\/admin|\/account|\/dashboard/);

  const robots = await request(app).get("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(robots.headers["content-type"] || "", /text\/plain/);
  assert.match(robots.text, /Disallow: \/admin\//);
  assert.match(robots.text, /Sitemap: https:\/\/sonaraindustries\.com\/sitemap\.xml/);

  for (const route of protectedRoutes) {
    const response = await request(app).get(route).set("Accept", "text/html");
    assert.equal(response.status, 303, `${route} should redirect anonymous users`);
    assert.equal(response.headers.location, "/login", `${route} should redirect to login`);
  }

  // The operator console was removed on 1 October 2026. This probed
  // /admin/audit and asserted it refused an anonymous caller with 401 or 503;
  // the stronger assertion now available is that nothing serves it. Kept rather
  // than dropped, because a reinstated operator route with no authorization test
  // is exactly what this smoke run exists to notice.
  const removedConsole = await request(app).get("/admin/audit").set("Accept", "application/json");
  assert.equal(
    removedConsole.status,
    404,
    `/admin/audit answered ${removedConsole.status}; the operator console is removed and nothing should serve it`
  );

  // And the business-owner controls that replaced it refuse a stranger. Without
  // this, the line above would pass just as well on a build that had removed the
  // owner's controls along with the console.
  const ownerControls = await request(app).get("/owner/administration").set("Accept", "text/html");
  assert.ok(
    [302, 303, 401, 403, 503].includes(ownerControls.status),
    `/owner/administration answered ${ownerControls.status} to an anonymous caller; it must refuse rather than render`
  );

  // The intake form and the endpoint behind it were removed on 1 October 2026.
  // Both halves are probed: a page that 404s while the endpoint still accepts
  // writes is the worse of the two things to leave behind.
  const intakePage = await request(app).get("/business-builder/intake").set("Accept", "text/html");
  assert.equal(intakePage.status, 404, `/business-builder/intake answered ${intakePage.status}; the intake page is removed`);
  const intakePost = await request(app)
    .post("/api/business-builder/intake")
    .set("Accept", "application/json")
    .send({ name: "A", email: "a@example.com", serviceInterest: "x", message: "y" });
  assert.equal(intakePost.status, 404, `the intake endpoint answered ${intakePost.status}; it should accept nothing`);

  const missing = await request(app).get("/__sonara_missing_route__").set("Accept", "text/html");
  assert.equal(missing.status, 404);
  assert.doesNotMatch(missing.text, mojibake);

  console.log(`Route smoke passed: ${publicRoutes.length} public, ${protectedRoutes.length} protected, sitemap, robots, the removed operator console answering 404, the owner controls refusing a stranger, the removed intake page and endpoint answering 404, and 404 behaviour.`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
