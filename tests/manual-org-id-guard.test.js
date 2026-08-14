"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "routes", "sonara-last9-routes.cjs"), "utf8");

// SONARA_ALLOW_MANUAL_ORG_ID accepts an organization_id from the request body
// with no membership check -- there cannot be one, because the branch exists to
// work without a resolved session. While it is on, any request can name any
// organization and every owner-record write that resolves through it writes
// into whichever tenant the body asked for.
//
// It was gated on the environment variable alone. One wrong value in a
// production dashboard was a cross-tenant write hole, and nothing in the
// release chain was looking at that value.
describe("the manual organization escape hatch", () => {
  it("is the only env-gated bypass in a request path", () => {
    // If another appears, it needs the same production guard, and this is where
    // somebody finds that out.
    const gated = [...SOURCE.matchAll(/process\.env\.([A-Z_]+) === "true"/g)].map((match) => match[1]);
    assert.deepEqual(
      [...new Set(gated)],
      ["SONARA_ALLOW_MANUAL_ORG_ID"],
      "a new env-gated bypass appeared; give it a production guard and add it here"
    );
  });

  it("checks the deployment environment as well as the variable", () => {
    // Asserted against the source because the alternative is booting the app
    // twice with different NODE_ENV, and a require cache makes that unreliable.
    const branch = SOURCE.slice(SOURCE.indexOf("const manualOrgAllowed"), SOURCE.indexOf("if (orgFromBody && manualOrgAllowed)"));
    assert.match(branch, /NODE_ENV !== "production"/, "the flag alone must not be enough");
    assert.match(branch, /VERCEL_ENV/, "a Vercel production deployment must also be excluded");
  });

  it("does not consult the flag before the session", () => {
    // The session path has to be tried first, or a body value would override a
    // real membership rather than only standing in for a missing one.
    const body = SOURCE.slice(SOURCE.indexOf("async function resolveOrganization"), SOURCE.indexOf("function getConfig"));
    assert.ok(
      body.indexOf("getCustomerPrimaryOrganization") < body.indexOf("SONARA_ALLOW_MANUAL_ORG_ID"),
      "the resolved session must be preferred over anything in the body"
    );
  });
});

describe("owner writes without a session", () => {
  const original = { ...process.env };
  let app;

  before(() => {
    process.env.NODE_ENV = "production";
    process.env.SONARA_ALLOW_MANUAL_ORG_ID = "true";
    delete require.cache[require.resolve("../server")];
    app = require("../server");
  });

  after(() => {
    for (const key of ["NODE_ENV", "SONARA_ALLOW_MANUAL_ORG_ID"]) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    delete require.cache[require.resolve("../server")];
  });

  it("refuses a body-supplied organization in production even with the flag on", async () => {
    const response = await request(app)
      .post("/api/business/customers")
      .type("form")
      .send({ organization_id: "11111111-1111-1111-1111-111111111111", name: "Someone else's customer" })
      .redirects(0);

    assert.notEqual(response.status, 200, "an unauthenticated write must not succeed");
    assert.notEqual(response.status, 303, "and must not redirect as though it saved");
  });
});
