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
const { envReadiness, INFRASTRUCTURE_SERVICES, CAPABILITY_EXPANSION_TRACKS } = require("../lib/sonara-infrastructure-manifest.cjs");

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
      assert.ok(res.body.capabilityExpansion && res.body.capabilityExpansion.total >= 14, "capability expansion tracks are missing");
      assert.equal(res.body.capabilityExpansion.tracks.length, CAPABILITY_EXPANSION_TRACKS.length);
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

  describe("capability expansion", () => {
    it("turns the known limitations into governed build tracks instead of marketing claims", () => {
      assert.ok(CAPABILITY_EXPANSION_TRACKS.length >= 14, `only ${CAPABILITY_EXPANSION_TRACKS.length} expansion tracks were registered`);
      const keys = new Set();
      for (const track of CAPABILITY_EXPANSION_TRACKS) {
        assert.ok(track.key, "an expansion track has no key");
        assert.ok(!keys.has(track.key), `duplicate expansion track ${track.key}`);
        keys.add(track.key);
        assert.ok(["foundation_active", "next_build", "gated", "planned"].includes(track.status), `${track.key} has unknown status ${track.status}`);
        assert.ok(Number.isInteger(track.phase) && track.phase >= 0, `${track.key} has no phase`);
        assert.ok(track.customerValue, `${track.key} has no customer value`);
        assert.ok(track.businessValue, `${track.key} has no business value`);
        assert.ok(track.target, `${track.key} has no target architecture`);
        assert.ok(track.claimBoundary, `${track.key} has no claim boundary`);
        assert.ok(Array.isArray(track.technologies) && track.technologies.length > 0, `${track.key} has no technology path`);
        assert.ok(Array.isArray(track.proofGates) && track.proofGates.length >= 3, `${track.key} has too few proof gates`);
      }
    });

    it("keeps Android a client/runtime track rather than falsely claiming a replacement hardware OS", () => {
      const android = CAPABILITY_EXPANSION_TRACKS.find((track) => track.key === "android_native_client");
      assert.ok(android, "Android native client track is missing");
      assert.equal(android.productionEnabled, false);
      assert.match(android.claimBoundary, /does not claim a hardware kernel/i);
      assert.ok(android.technologies.includes("Trusted Web Activity"));
      assert.match(android.target, /Capacitor server\\.url is not a production/i);
    });

    it("uses passkeys without creating a biometric identity database", () => {
      const passkeys = CAPABILITY_EXPANSION_TRACKS.find((track) => track.key === "passkeys_device_security");
      assert.ok(passkeys, "passkey track is missing");
      assert.equal(passkeys.serverStoresBiometrics, false);
      assert.match(passkeys.claimBoundary, /not fingerprints, face templates/i);
    });

    it("keeps autonomous event consumers gated until canary evidence exists", () => {
      const consumers = CAPABILITY_EXPANSION_TRACKS.find((track) => track.key === "autonomous_event_consumers");
      assert.ok(consumers, "event-consumer track is missing");
      assert.equal(consumers.status, "gated");
      assert.equal(consumers.productionEnabled, false);
      assert.ok(consumers.proofGates.some((gate) => /canary/i.test(gate)), "consumer activation has no canary gate");
    });

    it("does not relabel a third-party integration catalog as SONARA-native coverage", () => {
      const gateway = CAPABILITY_EXPANSION_TRACKS.find((track) => track.key === "integration_gateway");
      assert.ok(gateway, "integration gateway track is missing");
      assert.match(gateway.claimBoundary, /not SONARA's native integration count/i);
    });

    it("returns the same expansion contract through readiness without converting plans into green infrastructure", async () => {
      const res = await request(app).get("/api/infrastructure/readiness").set("Accept", "application/json");
      assert.equal(res.status, 200);
      assert.equal(res.body.capabilityExpansion.total, CAPABILITY_EXPANSION_TRACKS.length);
      assert.ok(res.body.capabilityExpansion.nextBuild.includes("android_native_client"));
      assert.ok(res.body.capabilityExpansion.gated.includes("autonomous_event_consumers"));
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
