"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const app = require("../server");
const root = path.join(__dirname, "..");

// /api/health names the build that answered, and something depends on that.
//
// scripts/smoke-live-routes.mjs confirms a deployment landed by polling this
// route and comparing `payload.deployment.commitSha` to the SHA the workflow
// expects. If the block disappears, that comparison never matches, and the far
// more likely outcome is that the gate is quietly loosened to tolerate its
// absence -- at which point a deployment gate stops gating deployments.
//
// It matters for reading checks too. `production-connectivity` runs against the
// live site on every pull request and passes; on 9 September 2026 it was passing
// against 36c1b2a while main sat 44 commits ahead, because deploys were blocked
// on a missing credential. This route is the only way to ask the running
// application which build it is.
describe("health says which build answered", () => {
  it("carries a deployment block with the three fields", async function probe() {
    this.timeout(20000);
    const response = await request(app).get("/api/health").set("Accept", "application/json");
    assert.equal(response.status, 200);
    assert.ok(response.body?.deployment, "/api/health carries no deployment block");
    for (const field of ["commitSha", "branch", "environment"]) {
      assert.ok(
        typeof response.body.deployment[field] === "string" && response.body.deployment[field].length > 0,
        `deployment.${field} is missing or empty, and the deployment gate reads deployment.commitSha`
      );
    }
  });

  it("says a truthful placeholder rather than an empty string when unset", async function probe() {
    // Locally there is no VERCEL_GIT_COMMIT_SHA. "local" is an answer; "" would
    // read as a deployed commit that happens to be blank, and the gate compares
    // strings.
    this.timeout(20000);
    const response = await request(app).get("/api/health").set("Accept", "application/json");
    assert.notEqual(response.body.deployment.commitSha, "", "an empty commitSha would compare as a real value");
  });

  it("is the field the deployment gate actually reads", () => {
    // Two files, one fact. If the smoke check ever reads a different path, this
    // test is asserting a contract nothing relies on.
    const smoke = fs.readFileSync(path.join(root, "scripts", "smoke-live-routes.mjs"), "utf8");
    assert.match(smoke, /deployment\?\.commitSha/, "smoke-live-routes.mjs no longer reads deployment.commitSha");
    assert.match(smoke, /\/api\/health/, "smoke-live-routes.mjs no longer polls /api/health");
  });

  it("does not leak a secret through the deployment values", async function probe() {
    // safePublicEnvValue strips anything outside a narrow character set. This is
    // a public route, so the values on it are public.
    this.timeout(20000);
    const response = await request(app).get("/api/health").set("Accept", "application/json");
    const serialised = JSON.stringify(response.body.deployment);
    assert.doesNotMatch(serialised, /eyJ[A-Za-z0-9_-]{8,}\./, "a JWT reached /api/health");
    assert.doesNotMatch(serialised, /sk_(live|test)_/, "a Stripe secret key reached /api/health");
  });
});
