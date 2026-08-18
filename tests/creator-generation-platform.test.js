"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/creator-generation-routes.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const JOB_ID = "33333333-3333-4333-8333-333333333333";
const ASSET_ID = "44444444-4444-4444-8444-444444444444";

function buildApp({ paid = true } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  registerRoutes(app, {
    layout: ({ title, heading, body, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
    requireWorkspaceAccess: () => (req, res, next) => {
      if (!paid) return res.status(402).json({ ok: false, code: "upgrade_required" });
      req.sonaraUser = { id: USER_ID, email: "creator@example.com" };
      return next();
    },
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
  });
  return app;
}

function jsonResponse(status, value, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", ...headers } });
}

function binaryResponse(status, bytes, mime = "audio/mpeg") {
  return new Response(Buffer.from(bytes), { status, headers: { "content-type": mime, "content-length": String(bytes.length) } });
}

function jobRecord(overrides = {}) {
  return {
    id: JOB_ID,
    organization_id: ORGANIZATION_ID,
    user_id: USER_ID,
    capability: "sound_effects",
    provider_key: "elevenlabs",
    prompt: "A cinematic metal door closing in a quiet warehouse",
    parameters: {},
    input_assets: [],
    status: "queued",
    progress_percent: 0,
    rights_attested: true,
    consent_attested: false,
    policy_status: "approved",
    policy_reasons: [],
    ...overrides
  };
}

describe("Creator Studio generation platform", () => {
  let originalFetch;
  let originalEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it("publishes a governed provider catalog without credential values", async () => {
    process.env.ELEVENLABS_ENABLED = "true";
    process.env.ELEVENLABS_API_KEY = "top-secret-key";
    const result = await request(buildApp()).get("/api/creator/generation/providers");
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.ok(result.body.providers.some((item) => item.key === "elevenlabs"));
    assert.ok(result.body.providers.some((item) => item.key === "google_veo"));
    assert.ok(result.body.providers.some((item) => item.key === "higgsfield"));
    assert.ok(result.body.providers.some((item) => item.key === "openvoice"));
    assert.doesNotMatch(JSON.stringify(result.body), /top-secret-key/);
  });

  it("requires paid Creator Studio access", async () => {
    const result = await request(buildApp({ paid: false })).get("/api/creator/generation/jobs");
    assert.equal(result.status, 402);
    assert.equal(result.body.code, "upgrade_required");
  });

  it("rejects generation without a rights attestation", async () => {
    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "text_to_music", provider_key: "elevenlabs", prompt: "Original minor-key instrumental" });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "rights_attestation_required");
  });

  it("holds direct artist or identity imitation language for review instead of dispatching", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : undefined });
      if (String(url).includes(`/rest/v1/creator_generation_jobs`) && options.method === "POST") {
        return jsonResponse(201, [jobRecord({ capability: "text_to_music", status: "review_required", policy_status: "review_required", policy_reasons: ["direct_identity_or_work_imitation_language"] })]);
      }
      if (String(url).includes(`/rest/v1/creator_generation_events`)) return jsonResponse(201, []);
      return jsonResponse(200, []);
    };

    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "text_to_music", provider_key: "elevenlabs", prompt: "Make this sound exactly like a famous artist", rights_attested: true });

    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "review_required");
    assert.equal(calls.some((call) => call.url.includes("api.elevenlabs.io")), false);
  });

  it("requires an active consent record for speech-to-speech", async () => {
    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "speech_to_speech", provider_key: "elevenlabs", prompt: "Convert this authorized recording", rights_attested: true });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "active_voice_consent_required");
  });

  // The scope column existed, was selected on every voice job, and decided
  // nothing. A permission given for text-to-speech authorised a voice clone --
  // the read is what made it look checked. AGENTS.md: "Enforce provenance,
  // consent, and anti-clone safety."
  describe("a voice permission has to be a permission for this", () => {
    const CONSENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    function withConsent(scope, extra = {}) {
      return async (url, options = {}) => {
        const target = String(url);
        if (target.includes("/rest/v1/creator_voice_consents")) {
          return jsonResponse(200, [{ id: CONSENT_ID, consent_attested: true, consent_scope: scope, expires_at: null, revoked_at: null, ...extra }]);
        }
        if (target.includes("/rest/v1/creator_generation_jobs") && options.method === "POST") {
          return jsonResponse(201, [jobRecord({ capability: "voice_clone", status: "approved" })]);
        }
        if (target.includes("/rest/v1/creator_generation_events")) return jsonResponse(201, []);
        return jsonResponse(200, []);
      };
    }

    // voice_clone for the refusals and speech_to_speech for the acceptances,
    // and the difference is not cosmetic: no provider declares voice_clone, so
    // a permitted voice_clone is refused later by the provider check. The
    // refusal cases stop at the policy, which is what they are about; the
    // acceptance cases have to reach the end, so they use the gated capability
    // ElevenLabs actually does.
    function jobWith(capability, scope, extra) {
      global.fetch = withConsent(scope, extra);
      return request(buildApp())
        .post("/api/creator/generation/jobs")
        .send({
          capability,
          provider_key: "elevenlabs",
          prompt: "Use the recording I have a signed release for",
          rights_attested: true,
          consent_attested: true,
          voice_consent_id: CONSENT_ID
        });
    }

    const cloneWith = (scope, extra) => jobWith("voice_clone", scope, extra);
    const convertWith = (scope, extra) => jobWith("speech_to_speech", scope, extra);

    it("refuses a voice clone on a permission given for text to speech", async () => {
      const result = await cloneWith("text_to_speech");
      assert.equal(result.status, 400);
      assert.equal(result.body.code, "voice_consent_scope_mismatch");
      // The message has to send them somewhere other than "record a
      // permission", which is what they already did.
      assert.match(String(result.body.reasons?.[0] || ""), /voice clone/);
    });

    it("refuses a voice clone on a permission given for singing", async () => {
      const result = await cloneWith("singing_voice");
      assert.equal(result.status, 400);
      assert.equal(result.body.code, "voice_consent_scope_mismatch");
    });

    it("refuses voice conversion on a permission given for singing", async () => {
      const result = await convertWith("singing_voice");
      assert.equal(result.status, 400);
      assert.equal(result.body.code, "voice_consent_scope_mismatch");
    });

    it("allows the one it was given for", async () => {
      const result = await convertWith("speech_to_speech");
      assert.equal(result.status, 201, `refused a matching permission: ${JSON.stringify(result.body)}`);
    });

    it("allows a blanket permission", async () => {
      const result = await convertWith("all_voice_generation");
      assert.equal(result.status, 201, `refused a blanket permission: ${JSON.stringify(result.body)}`);
    });

    // The scope check must not become the only check. A revoked or expired
    // permission with exactly the right scope is still not a permission.
    it("still refuses a revoked permission whose scope matches", async () => {
      const result = await cloneWith("voice_clone", { revoked_at: "2026-08-01T00:00:00Z" });
      assert.equal(result.status, 400);
      assert.equal(result.body.code, "active_voice_consent_required");
    });

    it("still refuses an expired permission whose scope matches", async () => {
      const result = await cloneWith("voice_clone", { expires_at: "2026-01-01T00:00:00Z" });
      assert.equal(result.status, 400);
      assert.equal(result.body.code, "active_voice_consent_required");
    });

    // The build-time half. Adding a capability to the gated set without
    // deciding what covers it fails here rather than at runtime, where the
    // answer is a refusal nobody can explain.
    it("has decided which permission covers every gated capability", () => {
      const routes = require("../routes/creator-generation-routes.cjs");
      const gated = [...routes.VOICE_CAPABILITIES];
      assert.ok(gated.length >= 5, `only ${gated.length} gated capabilities; this check has gone blind`);
      const undecided = gated.filter((capability) => !Array.isArray(routes.CONSENT_SCOPE_FOR_CAPABILITY[capability]));
      assert.deepEqual(undecided, [], "these are refused for a reason nobody can act on, because no scope was chosen for them");
    });

    // And the scopes named have to be scopes the database will accept, or a
    // permission that satisfies the check could never be created.
    it("names only scopes the consent table allows", () => {
      const fs = require("node:fs");
      const path = require("node:path");
      const routes = require("../routes/creator-generation-routes.cjs");
      const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260723080000_creator_generation_control_plane.sql"), "utf8");
      const constraint = sql.match(/consent_scope text not null check \(consent_scope in \(([^)]*)\)\)/);
      assert.ok(constraint, "the consent_scope constraint is gone; this check is asserting about nothing");
      const allowed = new Set([...constraint[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]));
      assert.ok(allowed.size >= 4, `only ${allowed.size} scopes parsed; this check has gone blind`);
      assert.ok(allowed.has(routes.BLANKET_CONSENT_SCOPE), "the blanket scope is not one the table accepts");
      const unstorable = [];
      for (const [capability, scopes] of Object.entries(routes.CONSENT_SCOPE_FOR_CAPABILITY)) {
        for (const scope of scopes) if (!allowed.has(scope)) unstorable.push(`${capability} accepts "${scope}", which the table refuses`);
      }
      assert.deepEqual(unstorable, [], unstorable.join("\n  "));
    });
  });

  // The menu and the providers, kept in agreement by construction rather than
  // by somebody remembering.
  it("offers no capability that no provider can do", () => {
    const routes = require("../routes/creator-generation-routes.cjs");
    const { getCreatorGenerationCatalog } = require("../lib/creator-generation-provider-registry.cjs");
    const supported = new Set(getCreatorGenerationCatalog().flatMap((provider) => provider.capabilities || []));
    assert.ok(supported.size >= 10, `only ${supported.size} provider capabilities; this check has gone blind`);

    const offered = routes.offeredCapabilities();
    assert.ok(offered.length >= 5, `only ${offered.length} capabilities offered; the form has gone empty`);
    const impossible = offered.filter((capability) => !supported.has(capability));
    assert.deepEqual(impossible, [], "the form offers these and nothing can run them");

    // And the intent list has to stay a superset, so dropping a capability
    // from the menu is a decision somebody makes rather than a provider
    // registry edit doing it silently.
    const stray = offered.filter((capability) => !routes.FORM_CAPABILITY_ORDER.includes(capability));
    assert.deepEqual(stray, [], "offered without being on the list this form is meant to show");
  });

  // The two that are currently filtered out. Written as an assertion rather
  // than a comment because the day a provider declares one, this fails and
  // tells the next person the menu just grew.
  it("still cannot run a voice clone or a singing voice, and says so by not offering them", () => {
    const routes = require("../routes/creator-generation-routes.cjs");
    const offered = new Set(routes.offeredCapabilities());
    for (const capability of ["voice_clone", "singing_voice"]) {
      assert.ok(routes.FORM_CAPABILITY_ORDER.includes(capability), `${capability} left the intent list; it should reappear on its own, not be deleted`);
      assert.ok(routes.VOICE_CAPABILITIES.has(capability), `${capability} is no longer gated by a voice permission`);
      assert.equal(offered.has(capability), false, `${capability} is offered now -- a provider declares it, so check the permission scope covers it and update this test`);
    }
  });

  it("records Higgsfield jobs as external MCP work rather than pretending to call an undocumented REST endpoint", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET" });
      if (String(url).includes(`/rest/v1/creator_generation_jobs`) && options.method === "POST") {
        return jsonResponse(201, [jobRecord({ capability: "text_to_video", provider_key: "higgsfield", status: "manual_required", provider_response: { connector: "external_mcp", endpoint: "https://mcp.higgsfield.ai" } })]);
      }
      if (String(url).includes(`/rest/v1/creator_generation_events`)) return jsonResponse(201, []);
      return jsonResponse(200, []);
    };

    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "text_to_video", provider_key: "higgsfield", prompt: "Original product launch scene", rights_attested: true });

    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "manual_required");
    assert.equal(calls.some((call) => call.url.startsWith("https://mcp.higgsfield.ai")), false);
  });

  it("dispatches ElevenLabs sound generation and stores the binary output in private Supabase storage", async () => {
    process.env.ELEVENLABS_ENABLED = "true";
    process.env.ELEVENLABS_API_KEY = "test-elevenlabs-key";
    const calls = [];
    let job = jobRecord();

    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const method = options.method || "GET";
      calls.push({ url: stringUrl, method, headers: options.headers, body: options.body });

      if (stringUrl.includes(`/rest/v1/creator_generation_jobs`) && method === "POST") return jsonResponse(201, [job]);
      if (stringUrl.includes(`/rest/v1/creator_generation_jobs`) && method === "PATCH") {
        const patch = JSON.parse(options.body);
        job = { ...job, ...patch };
        return jsonResponse(200, [job]);
      }
      if (stringUrl.includes(`/rest/v1/creator_generation_events`)) return jsonResponse(201, []);
      if (stringUrl === "https://api.elevenlabs.io/v1/sound-generation") return binaryResponse(200, Buffer.from("audio-output"), "audio/mpeg");
      if (stringUrl.includes(`/storage/v1/object/creator-assets/`) && method === "POST") return jsonResponse(200, { Key: "private-output" });
      if (stringUrl.includes(`/rest/v1/creator_generation_assets`) && method === "POST") {
        const body = JSON.parse(options.body);
        return jsonResponse(201, [{ id: ASSET_ID, ...body }]);
      }
      return jsonResponse(200, []);
    };

    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "sound_effects", provider_key: "elevenlabs", prompt: job.prompt, rights_attested: true, parameters: { duration_seconds: 4 } });

    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "completed");
    assert.ok(calls.some((call) => call.url === "https://api.elevenlabs.io/v1/sound-generation"));
    const storageCall = calls.find((call) => call.url.includes("/storage/v1/object/creator-assets/"));
    assert.ok(storageCall);
    assert.equal(storageCall.headers.Authorization, "Bearer server-only");
    assert.doesNotMatch(storageCall.url, /test-elevenlabs-key/);
  });

  it("submits Google Veo through the documented long-running operation contract", async () => {
    process.env.GOOGLE_VEO_ENABLED = "true";
    process.env.GEMINI_API_KEY = "gemini-test-key";
    let job = jobRecord({ capability: "text_to_video", provider_key: "google_veo" });
    const calls = [];

    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const method = options.method || "GET";
      calls.push({ url: stringUrl, method, headers: options.headers, body: options.body });
      if (stringUrl.includes(`/rest/v1/creator_generation_jobs`) && method === "POST") return jsonResponse(201, [job]);
      if (stringUrl.includes(`/rest/v1/creator_generation_jobs`) && method === "PATCH") {
        job = { ...job, ...JSON.parse(options.body) };
        return jsonResponse(200, [job]);
      }
      if (stringUrl.includes(`/rest/v1/creator_generation_events`)) return jsonResponse(201, []);
      if (stringUrl.includes(":predictLongRunning")) return jsonResponse(200, { name: "operations/veo-test-123" });
      return jsonResponse(200, []);
    };

    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "text_to_video", provider_key: "google_veo", prompt: "Original cinematic sunrise over Columbus", rights_attested: true, parameters: { aspect_ratio: "16:9" } });

    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "running");
    assert.equal(result.body.job.provider_job_id, "operations/veo-test-123");
    const providerCall = calls.find((call) => call.url.includes(":predictLongRunning"));
    assert.ok(providerCall);
    assert.equal(providerCall.headers["x-goog-api-key"], "gemini-test-key");
    assert.match(providerCall.url, /veo-3\.1-generate-preview/);
  });

  it("uses the canonical isolated open-media-worker job contract", async () => {
    process.env.CREATOR_MEDIA_WORKER_ENABLED = "true";
    process.env.CREATOR_MEDIA_WORKER_URL = "https://worker.example.com";
    process.env.CREATOR_MEDIA_WORKER_TOKEN = "worker-token";
    let job = jobRecord({ capability: "text_to_music", provider_key: "open_source_media_worker" });
    const calls = [];

    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      const method = options.method || "GET";
      calls.push({ url: stringUrl, method, body: options.body, headers: options.headers });
      if (stringUrl.includes(`/rest/v1/creator_generation_jobs`) && method === "POST") return jsonResponse(201, [job]);
      if (stringUrl.includes(`/rest/v1/creator_generation_jobs`) && method === "PATCH") {
        job = { ...job, ...JSON.parse(options.body) };
        return jsonResponse(200, [job]);
      }
      if (stringUrl.includes(`/rest/v1/creator_generation_events`)) return jsonResponse(201, []);
      if (stringUrl === "https://worker.example.com/v1/jobs") return jsonResponse(202, { id: "worker-job-1", status: "queued", progress_percent: 1 });
      return jsonResponse(200, []);
    };

    const result = await request(buildApp())
      .post("/api/creator/generation/jobs")
      .send({ capability: "text_to_music", provider_key: "open_source_media_worker", prompt: "Original instrumental", rights_attested: true });

    assert.equal(result.status, 201);
    assert.equal(result.body.job.status, "running");
    const workerCall = calls.find((call) => call.url === "https://worker.example.com/v1/jobs");
    assert.ok(workerCall);
    const payload = JSON.parse(workerCall.body);
    assert.equal(payload.organization_id, ORGANIZATION_ID);
    assert.equal(payload.capability, "text_to_music");
    assert.equal(workerCall.headers.Authorization, "Bearer worker-token");
  });

  // Generation work used to be reachable only as JSON: the studio page linked
  // "Your jobs" at /api/creator/generation/jobs, every row of its table linked
  // the job's API record, and submitting the create form landed the customer on
  // the same. These cover the pages that replaced that.

  it("gives the voice capabilities a way to be used at all", async () => {
    // Five capabilities -- speech_to_speech, voice_clone, singing_voice,
    // music_voice_profile, talking_avatar -- are refused by evaluatePolicy
    // without an active consent row. The only endpoint that creates one had no
    // form anywhere in the product, the generation form did not offer those
    // capabilities, and nothing wrote revoked_at. The gate was built,
    // advertised on the page, and had no key.
    global.fetch = async () => jsonResponse(200, []);
    const page = await request(buildApp()).get("/creator-studio/voice-permissions").set("accept", "text/html");
    assert.equal(page.status, 200);
    assert.match(page.text, /action="\/api\/creator\/generation\/voice-consents"/, "there is still no form that records a permission");
    assert.match(page.text, /consent_attested/, "the attestation the endpoint requires is not on the form");

    // Recording one is not a way around the gate: the wording has to keep
    // saying that having a record is not the same as having permission.
    assert.match(page.text, /not a substitute for having it/i);
  });

  it("offers the voice capabilities on the form once a permission exists", async () => {
    const CONSENT = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", subject_name: "Alex", subject_type: "authorized_person", consent_scope: "all_voice_generation", expires_at: null, revoked_at: null };
    global.fetch = async (url) => jsonResponse(200, String(url).includes("voice_consents") ? [CONSENT] : []);
    const withConsent = await request(buildApp()).get("/creator-studio/generation").set("accept", "text/html");
    assert.match(withConsent.text, /value="speech_to_speech"/, "voice conversion is still not offered");
    // Was `value="voice_clone"`, and it passed while the option could not run.
    // The list is derived from what a provider declares now; no provider in
    // lib/creator-generation-provider-registry.cjs does voice_clone or
    // singing_voice, so offering them meant a customer recorded a permission
    // naming a real person and then got capability_not_supported. The two
    // gated capabilities a provider does do are asserted instead, and the
    // check below is what would notice if the menu and the providers parted
    // company again.
    assert.match(withConsent.text, /value="music_voice_profile"/, "a gated capability a provider does do is missing");
    assert.match(withConsent.text, /value="talking_avatar"/);
    assert.doesNotMatch(withConsent.text, /value="voice_clone"/, "voice_clone is offered and nothing can run it");
    assert.match(withConsent.text, new RegExp(`value="${CONSENT.id}"`), "the permission is not selectable on the form");

    // With nothing on file the picker would be an empty dropdown beside a
    // checkbox, which reads as broken rather than as a step not yet taken.
    global.fetch = async () => jsonResponse(200, []);
    const without = await request(buildApp()).get("/creator-studio/generation").set("accept", "text/html");
    assert.match(without.text, /needs a permission on file first/i);
    assert.match(without.text, /\/creator-studio\/voice-permissions/, "the form does not say where to record one");
  });

  it("lets a permission be withdrawn, and only an active one", async () => {
    // evaluatePolicy reads revoked_at on every voice job and nothing wrote it,
    // so a permission could be given and never taken back.
    const patched = [];
    global.fetch = async (url, options = {}) => {
      if ((options.method || "GET") === "PATCH") {
        patched.push({ url: String(url), body: JSON.parse(options.body || "{}") });
        return jsonResponse(200, [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }]);
      }
      return jsonResponse(200, []);
    };
    const result = await request(buildApp())
      .post("/api/creator/generation/voice-consents/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/revoke")
      .type("form")
      .send({});
    assert.equal(result.status, 303);
    assert.equal(patched.length, 1, "nothing was withdrawn");
    assert.ok(patched[0].body.revoked_at, "revoked_at was not set");
    // Scoped, and only where it is not already withdrawn -- otherwise a second
    // press would silently rewrite the date somebody withdrew on.
    assert.match(patched[0].url, /organization_id=eq\./);
    assert.match(patched[0].url, /revoked_at=is\.null/);
  });

  it("does not tell a creator their work never existed when it cannot be read", async () => {
    // The generation landing page did `jobs = listed.ok ? listed.rows : []`, and
    // its empty state reads "Nothing yet. Use the form above to make your first
    // one." So a failed read told a creator their generated work had never
    // existed and invited them to start over -- about outputs they may have
    // paid for and waited on.
    global.fetch = async () => jsonResponse(500, []);
    const result = await request(buildApp()).get("/creator-studio/generation").set("accept", "text/html");
    assert.equal(result.status, 200, "the page should still render");
    assert.doesNotMatch(result.text, /Nothing yet/, "an unreadable job list is being reported as having never made anything");
    assert.match(result.text, /could not load your work just now/i, "nothing says the list could not be read");
    assert.doesNotMatch(result.text, /make your first one/i);
  });

  it("does not report a completed job as having produced nothing", async () => {
    // "Nothing was produced for this one" is the worst sentence in that file to
    // get wrong: the creator concludes the generation they waited for failed,
    // when the outputs are in a table that could not be read.
    global.fetch = async (url) => {
      const value = String(url);
      if (value.includes("creator_generation_jobs")) {
        return jsonResponse(200, [{ id: JOB_ID, title: "A song", capability: "music", provider_key: "suno", status: "completed", progress_percent: 100, created_at: "2026-01-01T00:00:00Z" }]);
      }
      // Assets and events are unreadable.
      return jsonResponse(500, []);
    };
    const result = await request(buildApp()).get(`/creator-studio/generation/jobs/${JOB_ID}`).set("accept", "text/html");
    assert.equal(result.status, 200);
    assert.doesNotMatch(result.text, /Nothing was produced for this one/, "an unreadable asset table is being reported as a job that produced nothing");
    assert.match(result.text, /could not load the outputs/i, "nothing says the outputs could not be read");
    assert.doesNotMatch(result.text, /Nothing has happened yet/, "an unreadable history is being reported as no history");
  });

  it("lists your generation work as a page, linking each piece at a page", async () => {
    global.fetch = async () => jsonResponse(200, [jobRecord({ title: "Warehouse door", status: "running", progress_percent: 40 })]);
    const result = await request(buildApp()).get("/creator-studio/generation/jobs").set("accept", "text/html");
    assert.equal(result.status, 200);
    assert.match(result.text, /Warehouse door/);
    assert.match(result.text, new RegExp(`/creator-studio/generation/jobs/${JOB_ID}`));
    assert.doesNotMatch(result.text, /\/api\/creator\/generation\/jobs/);
  });

  it("says where a piece of work is up to in words, not job states", async () => {
    global.fetch = async () => jsonResponse(200, [jobRecord({ status: "review_required", policy_status: "review_required", policy_reasons: ["identity_imitation"] })]);
    const result = await request(buildApp()).get(`/creator-studio/generation/jobs/${JOB_ID}`).set("accept", "text/html");
    assert.equal(result.status, 200);
    assert.match(result.text, /Held for review/);
    assert.match(result.text, /identity imitation/);
    assert.doesNotMatch(result.text, /review_required/);
  });

  it("offers a download for a finished file and nothing to collect before then", async () => {
    const asset = { id: ASSET_ID, job_id: JOB_ID, asset_role: "output", media_type: "audio", bucket_id: "creator-assets", object_path: "org/user/job/out.mp3", byte_size: 4096, created_at: "2026-01-01T00:00:00.000Z" };
    global.fetch = async (url) => jsonResponse(200, String(url).includes("creator_generation_assets") ? [asset] : [jobRecord({ status: "completed", progress_percent: 100 })]);
    const done = await request(buildApp()).get(`/creator-studio/generation/jobs/${JOB_ID}`).set("accept", "text/html");
    assert.match(done.text, new RegExp(`/creator-studio/generation/jobs/${JOB_ID}/outputs/${ASSET_ID}`));

    global.fetch = async (url) => jsonResponse(200, String(url).includes("creator_generation_assets") ? [] : [jobRecord({ status: "running" })]);
    const waiting = await request(buildApp()).get(`/creator-studio/generation/jobs/${JOB_ID}`).set("accept", "text/html");
    assert.match(waiting.text, /Nothing to collect yet/);
  });

  it("signs a private output on the server and never hands over the storage key", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      const stringUrl = String(url);
      calls.push({ url: stringUrl, method: options.method || "GET", headers: options.headers });
      if (stringUrl.includes("/storage/v1/object/sign/")) return jsonResponse(200, { signedURL: "/object/sign/creator-assets/out.mp3?token=short-lived" });
      if (stringUrl.includes("creator_generation_assets")) return jsonResponse(200, [{ id: ASSET_ID, bucket_id: "creator-assets", object_path: "org/user/job/out.mp3" }]);
      return jsonResponse(200, [jobRecord({ status: "completed" })]);
    };
    const result = await request(buildApp()).get(`/creator-studio/generation/jobs/${JOB_ID}/outputs/${ASSET_ID}`);
    assert.equal(result.status, 302);
    assert.match(result.headers.location, /token=short-lived/);
    assert.doesNotMatch(result.headers.location, /server-only/);
    const signing = calls.find((call) => call.url.includes("/storage/v1/object/sign/"));
    assert.equal(signing.method, "POST");
    assert.equal(signing.headers.Authorization, "Bearer server-only");
  });

  it("will not hand somebody another workspace's file", async () => {
    // The asset query is scoped by job, organization and user, so a mismatched
    // id returns nothing rather than a signed link.
    let signed = false;
    global.fetch = async (url) => {
      const stringUrl = String(url);
      if (stringUrl.includes("/storage/v1/object/sign/")) { signed = true; return jsonResponse(200, { signedURL: "/leak" }); }
      if (stringUrl.includes("creator_generation_assets")) return jsonResponse(200, []);
      return jsonResponse(200, [jobRecord()]);
    };
    const result = await request(buildApp()).get(`/creator-studio/generation/jobs/${JOB_ID}/outputs/${ASSET_ID}`);
    assert.equal(result.status, 303);
    assert.equal(result.headers.location, `/creator-studio/generation/jobs/${JOB_ID}`);
    assert.equal(signed, false);
  });

  it("returns a form submission to the page, not to the record behind it", async () => {
    let job = jobRecord({ status: "running" });
    global.fetch = async (url, options = {}) => {
      if (String(url).includes("creator_generation_jobs") && (options.method || "GET") === "PATCH") {
        job = { ...job, ...JSON.parse(options.body) };
        return jsonResponse(200, [job]);
      }
      return jsonResponse(200, [job]);
    };
    const result = await request(buildApp())
      .post(`/api/creator/generation/jobs/${JOB_ID}/cancel`)
      .set("accept", "text/html")
      .send("confirm=1");
    assert.equal(result.status, 303);
    assert.equal(result.headers.location, `/creator-studio/generation/jobs/${JOB_ID}`);
  });

  it("ships a private-output, RLS-first schema with no provider credential columns", () => {
    const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260723080000_creator_generation_control_plane.sql"), "utf8");
    assert.match(migration, /creator_generation_jobs/);
    assert.match(migration, /creator_generation_assets/);
    assert.match(migration, /creator_voice_consents/);
    assert.match(migration, /creator_reference_analyses/);
    assert.match(migration, /enable row level security/);
    assert.match(migration, /sonara_is_org_member/);
    assert.match(migration, /service role manages/);
    assert.doesNotMatch(migration, /api_key\s+text|secret_key\s+text|access_token\s+text/i);
  });
});
