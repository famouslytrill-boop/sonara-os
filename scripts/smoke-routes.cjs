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

  const admin = await request(app).get("/admin/audit").set("Accept", "application/json");
  assert.ok([401, 503].includes(admin.status), "/admin/audit should reject anonymous users");
  assert.equal(admin.body.ok, false);

  const missing = await request(app).get("/__sonara_missing_route__").set("Accept", "text/html");
  assert.equal(missing.status, 404);
  assert.doesNotMatch(missing.text, mojibake);

  console.log(`Route smoke passed: ${publicRoutes.length} public, ${protectedRoutes.length} protected, sitemap, robots, admin, and 404 behavior.`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
