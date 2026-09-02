"use strict";

// `routes/sonara-infrastructure-routes.cjs` was the one file in the coverage
// register that genuinely nothing reached: 16 of 55 lines, no test naming it
// and, unlike the other three in that position, no test driving its paths
// either. `/api/infrastructure/*` had nothing at all; `/infrastructure` was
// visited only by the plain-language crawl, which reads its words rather than
// its answers.
//
// Two of its four routes decide something a person acts on. `/api/infrastructure/readiness`
// answers whether this deployment can serve a paying customer, and
// `/admin/infrastructure` shows an owner which credentials are in place. The
// second carries a claim in its own copy -- "This page shows configuration
// state without exposing raw secret values" -- and AGENTS.md requires that
// service-role secrets stay server-only. A claim like that is worth a test
// rather than a comment.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const { envReadiness, INFRASTRUCTURE_SERVICES } = require("../lib/sonara-infrastructure-manifest.cjs");

describe("the infrastructure map says what is configured", () => {
  it("has services to report on", () => {
    assert.ok(
      INFRASTRUCTURE_SERVICES.length >= 10,
      `only ${INFRASTRUCTURE_SERVICES.length} infrastructure services; this check has gone blind`
    );
  });

  describe("the manifest", () => {
    it("lists the services, layers and mobile checks rather than an empty shell", async () => {
      const res = await request(app).get("/api/infrastructure/manifest").set("Accept", "application/json");
      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.ok(Array.isArray(res.body.services) && res.body.services.length >= 10, "the manifest returned no services");
      assert.ok(Array.isArray(res.body.pipelineLayers) && res.body.pipelineLayers.length > 0);
      assert.ok(Array.isArray(res.body.mobileExperienceChecks) && res.body.mobileExperienceChecks.length > 0);
    });

    it("names each service and says whether it is required to launch", async () => {
      const res = await request(app).get("/api/infrastructure/manifest").set("Accept", "application/json");
      for (const service of res.body.services) {
        assert.ok(service.key, "a service came back with no key");
        assert.ok(service.label, `${service.key} has no label to show anybody`);
        assert.ok(service.launchStatus, `${service.key} does not say whether launching depends on it`);
      }
    });
  });

  describe("readiness", () => {
    it("answers, and says which required services are missing", async () => {
      const res = await request(app).get("/api/infrastructure/readiness").set("Accept", "application/json");
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.services) && res.body.services.length >= 10);
      assert.ok(Array.isArray(res.body.missingRequiredServices));
      assert.ok(["ready", "setup_required"].includes(res.body.status), `unexpected status ${res.body.status}`);
    });

    it("does not call itself ready while a required service is missing", async () => {
      // The two fields have to agree. `ok: true` beside a non-empty list of
      // missing required services is the shape of a green light over a problem.
      const res = await request(app).get("/api/infrastructure/readiness").set("Accept", "application/json");
      if (res.body.missingRequiredServices.length > 0) {
        assert.equal(res.body.ok, false, `ok was true while ${res.body.missingRequiredServices.join(", ")} were missing`);
        assert.equal(res.body.status, "setup_required");
      } else {
        assert.equal(res.body.ok, true);
        assert.equal(res.body.status, "ready");
      }
    });

    it("derives that answer from the environment rather than from a constant", () => {
      // Called directly with two different environments. If the same answer
      // came back for both, the endpoint would be reporting a fixed opinion
      // dressed as a measurement.
      const nothingSet = envReadiness({});
      const somethingSet = envReadiness({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service"
      });
      const configuredCount = (list) => list.filter((service) => service.configured).length;
      assert.ok(
        configuredCount(somethingSet) > configuredCount(nothingSet),
        "setting Supabase's variables changed nothing, so this is not reading the environment"
      );
    });

    it("reports whether a secret is set without reporting what it is", async () => {
      // AGENTS.md: "Keep service-role secrets server-only." The page's own copy
      // claims it shows state "without exposing raw secret values", and this is
      // what makes that a checked claim rather than a comment.
      const value = "sk_probe_value_that_must_never_be_returned_9f3a";
      const services = envReadiness({
        SUPABASE_SERVICE_ROLE_KEY: value,
        STRIPE_SECRET_KEY: value,
        RESEND_API_KEY: value
      });
      const serialised = JSON.stringify(services);
      assert.ok(!serialised.includes(value), "a secret's value came back in the readiness payload");

      // And it must still have noticed the variable is set, or the check above
      // would pass on a payload that reports nothing at all.
      assert.ok(
        services.some((service) => (service.env || []).some((entry) => entry.configured)),
        "no variable was reported as configured, so the check above proves nothing"
      );
    });
  });

  describe("the pages", () => {
    it("renders the public infrastructure page", async () => {
      const res = await request(app).get("/infrastructure").set("Accept", "text/html");
      assert.equal(res.status, 200);
      assert.equal(res.type, "text/html");
      assert.match(res.text, /SONARA Infrastructure/);
      assert.ok(res.text.length > 2000, `the page was ${res.text.length} bytes; it should be listing every service`);
    });

    it("does not put a secret's value on the public page either", async () => {
      const res = await request(app).get("/infrastructure").set("Accept", "text/html");
      for (const name of ["SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "RESEND_API_KEY"]) {
        const actual = process.env[name];
        if (actual && actual.length > 8) {
          assert.ok(!res.text.includes(actual), `${name}'s value is on the public infrastructure page`);
        }
      }
    });

    it("keeps the admin view behind the admin gate", async () => {
      const res = await request(app).get("/admin/infrastructure").set("Accept", "text/html");
      assert.notEqual(res.status, 200, "the admin infrastructure view answered an unauthenticated request with a page");
    });
  });
});
