"use strict";

const assert = require("node:assert/strict");
const adapter = require("../lib/sonara-ollama-adapter.cjs");

const KEYS = adapter.ENV_KEYS;
const saved = {};

function setEnv(values) {
  for (const [key, value] of Object.entries(values)) {
    if (!(key in saved)) saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function configured(extra = {}) {
  setEnv({ [KEYS.enabled]: "true", [KEYS.baseUrl]: "http://models.internal:11434", [KEYS.model]: "llama3", ...extra });
  return adapter.getOllamaReadiness({ isServerless: false });
}

describe("the local model adapter", () => {
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const key of Object.keys(saved)) delete saved[key];
  });

  it("is off unless explicitly turned on", () => {
    setEnv({ [KEYS.enabled]: undefined, [KEYS.baseUrl]: "http://models.internal:11434", [KEYS.model]: "llama3" });
    const readiness = adapter.getOllamaReadiness({ isServerless: false });
    assert.equal(readiness.enabled, false);
    assert.equal(readiness.ok, true, "being off is a valid state, not a fault");
  });

  it("names loopback as unreachable on serverless rather than letting it time out in production", () => {
    // The failure this exists to prevent: configured, plausible, and silently
    // unreachable from where the code actually runs.
    for (const host of ["localhost", "127.0.0.1", "0.0.0.0"]) {
      setEnv({ [KEYS.enabled]: "true", [KEYS.baseUrl]: `http://${host}:11434`, [KEYS.model]: "llama3" });
      const readiness = adapter.getOllamaReadiness({ isServerless: true });
      assert.equal(readiness.status, "unreachable_from_serverless", `${host} must be caught`);
      assert.match(readiness.detail, /the function's own container/);
    }
  });

  it("allows loopback when the server is not serverless", () => {
    setEnv({ [KEYS.enabled]: "true", [KEYS.baseUrl]: "http://localhost:11434", [KEYS.model]: "llama3" });
    assert.equal(adapter.getOllamaReadiness({ isServerless: false }).status, "configured");
  });

  it("refuses a placeholder rather than treating it as configured", () => {
    for (const value of ["your-url-here", "changeme", "example"]) {
      setEnv({ [KEYS.enabled]: "true", [KEYS.baseUrl]: value, [KEYS.model]: "llama3" });
      assert.equal(adapter.getOllamaReadiness({ isServerless: false }).status, "setup_required");
    }
  });

  it("never reports the configured URL, only its host", () => {
    // A base URL can carry a token in its query string, and readiness is
    // rendered onto a page.
    setEnv({ [KEYS.enabled]: "true", [KEYS.baseUrl]: "http://models.internal:11434/?token=secret-value", [KEYS.model]: "llama3" });
    const readiness = adapter.getOllamaReadiness({ isServerless: false });
    assert.equal(JSON.stringify(readiness).includes("secret-value"), false);
    assert.equal(readiness.host, "models.internal");
  });

  it("bounds the timeout rather than trusting the value in the environment", () => {
    assert.equal(configured({ [KEYS.timeout]: "999999" }).timeoutMs, adapter.MAX_TIMEOUT_MS);
    assert.equal(configured({ [KEYS.timeout]: "-5" }).timeoutMs, adapter.DEFAULT_TIMEOUT_MS);
    assert.equal(configured({ [KEYS.timeout]: "abc" }).timeoutMs, adapter.DEFAULT_TIMEOUT_MS);
    assert.equal(configured({ [KEYS.timeout]: "5000" }).timeoutMs, 5000);
  });

  it("returns a failure rather than throwing when the host does not answer", async () => {
    const readiness = configured();
    const result = await adapter.generate("hello", { readiness, fetchImpl: async () => { throw new Error("ECONNREFUSED http://models.internal:11434"); } });
    assert.equal(result.ok, false);
    assert.equal(result.code, "failed");
  });

  it("does not pass a fetch error message through, because it carries the configured URL", async () => {
    const readiness = configured();
    const result = await adapter.generate("hello", { readiness, fetchImpl: async () => { throw new Error("connect failed to http://models.internal:11434/?token=secret-value"); } });
    assert.equal(JSON.stringify(result).includes("secret-value"), false);
  });

  it("times out rather than holding the request open", async () => {
    const readiness = { ...configured(), timeoutMs: 20 };
    const result = await adapter.generate("hello", {
      readiness,
      fetchImpl: (url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "timed_out");
  });

  it("refuses to call at all when it is not configured", async () => {
    setEnv({ [KEYS.enabled]: undefined });
    let called = false;
    const result = await adapter.generate("hello", {
      readiness: adapter.getOllamaReadiness({ isServerless: false }),
      fetchImpl: async () => { called = true; return { ok: true, json: async () => ({ response: "hi" }) }; }
    });
    assert.equal(result.ok, false);
    assert.equal(called, false, "a disabled adapter must not reach the network");
  });

  it("treats an empty model answer as a failure, not as an answer", async () => {
    const readiness = configured();
    const result = await adapter.generate("hello", { readiness, fetchImpl: async () => ({ ok: true, json: async () => ({ response: "   " }) }) });
    assert.equal(result.ok, false);
    assert.equal(result.code, "empty_response");
  });

  it("returns the answer when the host does answer", async () => {
    const readiness = configured();
    const result = await adapter.generate("hello", { readiness, fetchImpl: async () => ({ ok: true, json: async () => ({ response: "  an answer  " }) }) });
    assert.deepEqual({ ok: result.ok, text: result.text }, { ok: true, text: "an answer" });
  });
});
