"use strict";

// Reaching a service the owner runs, without becoming a place that holds voices.
//
// The adapter family in this repository all shares one shape: off by default,
// never a dependency, never renders configuration, and validates anything that
// becomes part of a request. `docs/architecture/EXTERNAL-SERVICES.md` sets
// those four out and `lib/sonara-service-adapter.cjs` implements most of them
// once. This file checks that the voice adapter really does inherit them, plus
// the two rules that are specific to it:
//
// **It carries no audio.** Not the reference clip, not the consent recording,
// not the result. One GET that returns capabilities, and nothing else.
//
// **The token is required rather than optional.** Every other adapter in the
// family can be pointed at a service with no authentication and still work. A
// voice cloner reachable from the internet with no token on it is a voice
// cloner anybody can use, so readiness refuses to call itself configured
// without one.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const adapter = require("../lib/sonara-voice-clone-adapter.cjs");
const routes = require("../routes/sonara-voice-studio-routes.cjs");

const KEYS = adapter.ENV_KEYS;

function withEnv(values, run) {
  const saved = {};
  for (const [key, value] of Object.entries(values)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const CONFIGURED = {
  [KEYS.enabled]: "true",
  [KEYS.baseUrl]: "https://voice.example.com",
  [KEYS.token]: "a-real-looking-token"
};

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("the voice studio adapter", () => {
  describe("off by default", () => {
    it("reports disabled when nothing is set", () => {
      const readiness = withEnv({ [KEYS.enabled]: undefined, [KEYS.baseUrl]: undefined, [KEYS.token]: undefined },
        () => adapter.getVoiceCloneReadiness());
      assert.equal(readiness.enabled, false);
      assert.equal(readiness.status, "disabled");
      // ok:true because being off is not a fault. A page must not report a
      // problem for a feature nobody turned on.
      assert.equal(readiness.ok, true);
    });

    it("makes no call when it is on but not finished being set up", async () => {
      // A separate guard from the disabled one, and the one that matters on a
      // half-configured deployment: enabled, with a URL, and no token yet. The
      // probe that removed this guard did not fail anything until this existed.
      let called = 0;
      const readiness = withEnv({ ...CONFIGURED, [KEYS.token]: undefined }, () => adapter.getVoiceCloneReadiness());
      assert.equal(readiness.enabled, true, "the fixture is disabled, so this is testing the wrong guard");
      assert.equal(readiness.status, "setup_required");
      const result = await adapter.capabilities(readiness, { fetchImpl: async () => { called += 1; return jsonResponse({}); } });
      assert.equal(called, 0, "a half-configured adapter reached out to the network");
      assert.equal(result.code, "setup_required");
    });

    it("makes no call at all when it is off", async () => {
      let called = 0;
      const readiness = withEnv({ [KEYS.enabled]: undefined }, () => adapter.getVoiceCloneReadiness());
      const result = await adapter.capabilities(readiness, { fetchImpl: async () => { called += 1; return jsonResponse({}); } });
      assert.equal(called, 0, "an unconfigured adapter reached out to the network");
      assert.equal(result.ok, false);
      assert.equal(result.code, "disabled");
    });
  });

  describe("the token is required, unlike every other adapter in the family", () => {
    it("refuses to be configured without one", () => {
      const readiness = withEnv({ ...CONFIGURED, [KEYS.token]: undefined }, () => adapter.getVoiceCloneReadiness());
      assert.equal(readiness.status, "setup_required");
      assert.ok(readiness.detail.includes(KEYS.token), "the refusal does not name the variable that is missing");
    });

    it("refuses a placeholder token", () => {
      const readiness = withEnv({ ...CONFIGURED, [KEYS.token]: "your-token-here" }, () => adapter.getVoiceCloneReadiness());
      assert.equal(readiness.status, "setup_required");
    });

    it("sends it, so the service can actually refuse a stranger", async () => {
      const readiness = withEnv(CONFIGURED, () => adapter.getVoiceCloneReadiness());
      let seen = null;
      await adapter.capabilities(readiness, {
        fetchImpl: async (url, init) => { seen = init; return jsonResponse({ engine: "stub" }); }
      });
      assert.equal(seen.headers.Authorization, "Bearer a-real-looking-token");
    });
  });

  describe("never renders configuration", () => {
    it("keeps the token off the readiness object", () => {
      const readiness = withEnv(CONFIGURED, () => adapter.getVoiceCloneReadiness());
      assert.equal(readiness.status, "configured");
      const serialised = JSON.stringify(readiness);
      assert.ok(!serialised.includes("a-real-looking-token"), "the token is reachable through JSON.stringify");
      assert.ok(!Object.keys(readiness).includes("token"), "the token is an enumerable property");
      // Still readable by the code that needs it.
      assert.equal(readiness.token, "a-real-looking-token");
    });

    it("keeps the full URL off it too, and reports only the host", () => {
      const readiness = withEnv({ ...CONFIGURED, [KEYS.baseUrl]: "https://voice.example.com/path?key=secret-in-the-url" },
        () => adapter.getVoiceCloneReadiness());
      const serialised = JSON.stringify(readiness);
      assert.ok(!serialised.includes("secret-in-the-url"), "a token in the URL's query string reached a serialisable property");
      assert.equal(readiness.host, "voice.example.com");
    });

    it("never passes a fetch error's message through", async () => {
      const readiness = withEnv(CONFIGURED, () => adapter.getVoiceCloneReadiness());
      const result = await adapter.capabilities(readiness, {
        fetchImpl: async () => { throw new Error("connect ECONNREFUSED https://voice.example.com/api/capabilities?key=leaked"); }
      });
      assert.equal(result.ok, false);
      assert.ok(!result.detail.includes("leaked"), "the configured URL came back inside an error message");
      assert.ok(!result.detail.includes("voice.example.com"));
    });
  });

  describe("names the one address that cannot work", () => {
    for (const host of ["localhost", "127.0.0.1", "0.0.0.0"]) {
      it(`refuses ${host} on a serverless deployment, and says why`, () => {
        const readiness = withEnv({ ...CONFIGURED, [KEYS.baseUrl]: `http://${host}:8000` },
          () => adapter.getVoiceCloneReadiness({ isServerless: true }));
        assert.equal(readiness.status, "unreachable_from_serverless");
        assert.ok(readiness.detail.includes("EXTERNAL-SERVICES"), "the refusal does not point at the document that fixes it");
      });
    }

    it("allows it when this is not serverless, because then it is simply true", () => {
      const readiness = withEnv({ ...CONFIGURED, [KEYS.baseUrl]: "http://localhost:8000" },
        () => adapter.getVoiceCloneReadiness({ isServerless: false }));
      assert.equal(readiness.status, "configured");
    });
  });

  describe("what comes back is narrowed before it reaches a page", () => {
    it("narrows what capabilities() returns, not just what summarise() returns", async () => {
      // The first version of this only exercised summarise() directly, so a
      // capabilities() that stopped calling it would have passed. Probed by
      // spreading the raw body alongside the summary; the probe did not fire,
      // which is how the gap was found.
      const readiness = withEnv(CONFIGURED, () => adapter.getVoiceCloneReadiness());
      const result = await adapter.capabilities(readiness, {
        fetchImpl: async () => jsonResponse({
          engine: "openvoice-v2",
          produces_real_speech: true,
          languages: { en: "English" },
          styles: ["default"],
          internal_paths: ["/home/somebody/checkpoints"],
          api_token: "should-never-appear"
        })
      });
      assert.equal(result.ok, true);
      const serialised = JSON.stringify(result.data);
      assert.ok(!serialised.includes("should-never-appear"), "the service's own token reached the page through capabilities()");
      assert.ok(!serialised.includes("/home/somebody"), "a filesystem path reached the page through capabilities()");
      assert.deepEqual(
        Object.keys(result.data).sort(),
        ["engine", "languages", "note", "producesRealSpeech", "styles"],
        "capabilities() returned fields beyond the ones this application renders"
      );
    });

    it("keeps only the fields this application renders", () => {
      const summary = adapter.summarise({
        engine: "openvoice-v2",
        produces_real_speech: true,
        engine_note: "loaded",
        languages: { en: "English", es: "Spanish" },
        styles: ["default"],
        // Anything the service adds later must not ride through onto a page.
        internal_paths: ["/home/somebody/checkpoints"],
        api_token: "should-never-appear"
      });
      const serialised = JSON.stringify(summary);
      assert.ok(!serialised.includes("should-never-appear"));
      assert.ok(!serialised.includes("/home/somebody"));
      assert.deepEqual(summary.languages, [{ code: "en", name: "English" }, { code: "es", name: "Spanish" }]);
    });

    it("treats a missing answer as unknown rather than as no", () => {
      // Absent is not false. A service that did not say whether it has a speech
      // model must not be reported as having said it has none.
      assert.equal(adapter.summarise({}).producesRealSpeech, null);
      assert.equal(adapter.summarise({ produces_real_speech: false }).producesRealSpeech, false);
      assert.equal(adapter.summarise({ produces_real_speech: "yes" }).producesRealSpeech, null);
    });

    it("survives a service answering with the wrong shapes", () => {
      const summary = adapter.summarise({ languages: ["not", "an", "object"], styles: "not an array", engine: 42 });
      assert.deepEqual(summary.languages, []);
      assert.deepEqual(summary.styles, []);
      assert.equal(summary.engine, "unknown");
    });

    it("reports a rejected token differently from a service that is down", async () => {
      const readiness = withEnv(CONFIGURED, () => adapter.getVoiceCloneReadiness());
      const rejected = await adapter.capabilities(readiness, { fetchImpl: async () => jsonResponse({}, 401) });
      const down = await adapter.capabilities(readiness, { fetchImpl: async () => jsonResponse({}, 502) });
      assert.equal(rejected.code, "rejected");
      assert.equal(down.code, "unreachable");
      assert.ok(rejected.detail.includes(KEYS.token), "a rejected token does not name the variable to check");
    });
  });

  describe("it carries no audio, and the source says so", () => {
    it("exposes no function that takes or returns a file", () => {
      // The adapter's whole surface. If somebody adds a clone() here, this
      // fails and the conversation happens before the audio does.
      assert.deepEqual(
        Object.keys(adapter).sort(),
        ["ENV_KEYS", "LABEL", "capabilities", "getVoiceCloneReadiness", "summarise"]
      );
    });

    it("issues exactly one GET and sends no body", async () => {
      const readiness = withEnv(CONFIGURED, () => adapter.getVoiceCloneReadiness());
      const calls = [];
      await adapter.capabilities(readiness, {
        fetchImpl: async (url, init) => { calls.push({ url, init }); return jsonResponse({ engine: "stub" }); }
      });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].init.method, "GET");
      assert.equal(calls[0].init.body, undefined, "a GET was given a body");
      assert.ok(calls[0].url.endsWith("/api/capabilities"));
    });

    it("mentions no multipart or upload handling anywhere in the module", () => {
      const source = fs.readFileSync(path.join(__dirname, "..", "lib", "sonara-voice-clone-adapter.cjs"), "utf8");
      const code = source.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
      for (const term of ["FormData", "multipart", "Blob", "createReadStream"]) {
        assert.ok(!code.includes(term), `the adapter references ${term}, so it may be carrying a file`);
      }
    });
  });

  describe("the page says the consent rule whether or not anything is configured", () => {
    it("has a rule to say, with more than one clause", () => {
      assert.ok(routes.CONSENT_RULE.length >= 3, "the consent rule has been thinned out to almost nothing");
      const joined = routes.CONSENT_RULE.join(" ").toLowerCase();
      assert.ok(joined.includes("consent"));
      assert.ok(joined.includes("watermark"), "the provenance half of the rule is missing");
      assert.ok(
        joined.includes("never treated as consent"),
        "the rule no longer says that an unrunnable check is not consent"
      );
    });

    it("has a plain-language explanation for every state it can be in", () => {
      const states = ["disabled", "setup_required", "unreachable_from_serverless", "configured",
        "rejected", "unreachable", "timed_out", "failed", "unreadable_response"];
      for (const state of states) {
        assert.ok(routes.EXPLAIN[state], `no explanation for the state ${state}`);
        assert.ok(!routes.EXPLAIN[state].includes("_"), `the explanation for ${state} is a code, not a sentence`);
      }
    });

    it("prefers the probe's failure over the readiness state when both have one", () => {
      // Configured but not answering is a different problem from not configured,
      // and showing the first as the second sends somebody to edit variables
      // that are already right.
      const described = routes.describe(
        { status: "configured", detail: "configured at voice.example.com", host: "voice.example.com" },
        { ok: false, code: "timed_out", detail: "it did not answer in time" }
      );
      assert.equal(described.state, "timed_out");
      assert.equal(described.capabilities, null);
    });
  });
});
