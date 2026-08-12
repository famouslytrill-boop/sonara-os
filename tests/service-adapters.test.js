"use strict";

const assert = require("node:assert/strict");
const base = require("../lib/sonara-service-adapter.cjs");
const langflow = require("../lib/sonara-langflow-adapter.cjs");
const openWebUi = require("../lib/sonara-open-webui-adapter.cjs");
const crawl = require("../lib/sonara-crawl4ai-adapter.cjs");
const ollama = require("../lib/sonara-ollama-adapter.cjs");

const saved = {};
function setEnv(values) {
  for (const [key, value] of Object.entries(values)) {
    if (!(key in saved)) saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const ADAPTERS = [
  { name: "Ollama", keys: ollama.ENV_KEYS, readiness: (o) => ollama.getOllamaReadiness(o), extras: { model: "llama3" } },
  { name: "Langflow", keys: langflow.ENV_KEYS, readiness: (o) => langflow.getLangflowReadiness(o), extras: { flow: "flow-1" } },
  { name: "Open WebUI", keys: openWebUi.ENV_KEYS, readiness: (o) => openWebUi.getOpenWebUiReadiness(o), extras: { model: "llama3", key: "secret-key-value" } },
  { name: "Crawl4AI", keys: crawl.ENV_KEYS, readiness: (o) => crawl.getCrawl4aiReadiness(o), extras: {} }
];

describe("every external service adapter", () => {
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const key of Object.keys(saved)) delete saved[key];
  });

  it("covers all four, so a new one cannot skip these rules", () => {
    assert.equal(ADAPTERS.length, 4, "an adapter was added without being added here");
  });

  for (const adapter of ADAPTERS) {
    describe(adapter.name, () => {
      function configure(overrides = {}) {
        const values = { [adapter.keys.enabled]: "true", [adapter.keys.baseUrl]: "http://service.internal:8080" };
        for (const [name, value] of Object.entries(adapter.extras)) values[adapter.keys[name]] = value;
        setEnv({ ...values, ...overrides });
        return adapter.readiness({ isServerless: false });
      }

      it("is off unless explicitly turned on", () => {
        setEnv({ [adapter.keys.enabled]: undefined });
        const readiness = adapter.readiness({ isServerless: false });
        assert.equal(readiness.enabled, false);
        assert.equal(readiness.ok, true, "off is a valid state, not a fault");
      });

      it("names loopback as unreachable on serverless rather than timing out in production", () => {
        configure({ [adapter.keys.baseUrl]: "http://localhost:8080" });
        const readiness = adapter.readiness({ isServerless: true });
        assert.equal(readiness.status, "unreachable_from_serverless");
      });

      it("never renders the configured URL, only the host", () => {
        const readiness = configure({ [adapter.keys.baseUrl]: "http://service.internal:8080/?token=secret-value" });
        assert.equal(JSON.stringify(readiness).includes("secret-value"), false, "a token in the URL must not reach a page");
        assert.equal(readiness.host, "service.internal");
      });

      it("refuses a placeholder rather than treating it as configured", () => {
        configure({ [adapter.keys.baseUrl]: "changeme" });
        assert.equal(adapter.readiness({ isServerless: false }).status, "setup_required");
      });

      it("bounds the timeout rather than trusting the environment", () => {
        assert.equal(configure({ [adapter.keys.timeout]: "999999" }).timeoutMs, base.MAX_TIMEOUT_MS);
        assert.equal(configure({ [adapter.keys.timeout]: "abc" }).timeoutMs, base.DEFAULT_TIMEOUT_MS);
      });

      it("reports every missing required setting rather than only the URL", () => {
        for (const name of Object.keys(adapter.extras)) {
          configure({ [adapter.keys[name]]: undefined });
          const readiness = adapter.readiness({ isServerless: false });
          assert.equal(readiness.status, "setup_required", `${name} missing must be setup_required`);
          assert.match(readiness.detail, new RegExp(adapter.keys[name]), `the detail must name ${adapter.keys[name]}`);
        }
      });
    });
  }
});

describe("the shared call path", () => {
  const readiness = { enabled: true, status: "configured", timeoutMs: 20, host: "service.internal", model: "m" };
  Object.defineProperty(readiness, "baseUrl", { value: "http://service.internal:8080", enumerable: false });

  it("distinguishes a timeout from an error status, because they send you to different places", async () => {
    const timedOut = await base.postJson(readiness, "/x", {}, {
      fetchImpl: (url, options) => new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
    });
    assert.equal(timedOut.code, "timed_out");

    const errored = await base.postJson(readiness, "/x", {}, { fetchImpl: async () => ({ ok: false, status: 502 }) });
    assert.equal(errored.code, "unreachable");
  });

  it("never passes a fetch error message through, because it carries the URL", async () => {
    const result = await base.postJson(readiness, "/x", {}, {
      fetchImpl: async () => { throw new Error("failed to http://service.internal:8080/?token=secret-value"); }
    });
    assert.equal(JSON.stringify(result).includes("secret-value"), false);
  });

  it("does not reach the network when the service is off", async () => {
    let called = false;
    const result = await base.postJson({ enabled: false, detail: "off" }, "/x", {}, { fetchImpl: async () => { called = true; } });
    assert.equal(called, false);
    assert.equal(result.ok, false);
  });
});

describe("Langflow flow ids", () => {
  it("refuses an id that would address a different endpoint", async () => {
    for (const flow of ["../admin", "a/b", "x?y=1", "a b"]) {
      const readiness = { enabled: true, status: "configured", flow, timeoutMs: 100 };
      Object.defineProperty(readiness, "baseUrl", { value: "http://service.internal", enumerable: false });
      let called = false;
      const result = await langflow.runFlow("hello", { readiness, fetchImpl: async () => { called = true; } });
      assert.equal(result.code, "invalid_flow_id", `${flow} must be refused`);
      assert.equal(called, false, `${flow} must not reach the network`);
    }
  });

  it("accepts an ordinary id", () => {
    assert.ok(langflow.FLOW_ID.test("my_flow-1"));
  });
});

describe("Crawl4AI targets", () => {
  it("refuses private and loopback addresses, because this server would be the one fetching them", () => {
    for (const target of [
      "http://localhost/x", "http://127.0.0.1/x", "http://10.1.2.3/x", "http://192.168.0.1/x",
      "http://169.254.169.254/latest/meta-data/", "http://172.16.0.1/x", "http://[::1]/x"
    ]) {
      assert.ok(crawl.reasonNotCrawlable(target), `${target} must be refused`);
    }
  });

  it("refuses a scheme that is not http or https", () => {
    for (const target of ["file:///etc/passwd", "ftp://example.com", "gopher://example.com"]) {
      assert.ok(crawl.reasonNotCrawlable(target), `${target} must be refused`);
    }
  });

  it("refuses a URL carrying credentials rather than sending them", () => {
    assert.match(crawl.reasonNotCrawlable("http://user:pass@example.com/x"), /username or password/);
  });

  it("allows an ordinary public address", () => {
    assert.equal(crawl.reasonNotCrawlable("https://example.com/article"), null);
  });

  it("does not reach the network for a refused target", async () => {
    let called = false;
    const result = await crawl.fetchPage("http://169.254.169.254/latest/meta-data/", {
      readiness: { enabled: true, status: "configured", timeoutMs: 100 },
      fetchImpl: async () => { called = true; }
    });
    assert.equal(called, false);
    assert.equal(result.code, "refused_target");
  });
});

describe("Open WebUI credentials", () => {
  it("keeps the API key off the readiness object callers render", () => {
    setEnv({
      [openWebUi.ENV_KEYS.enabled]: "true",
      [openWebUi.ENV_KEYS.baseUrl]: "http://service.internal:8080",
      [openWebUi.ENV_KEYS.model]: "llama3",
      [openWebUi.ENV_KEYS.key]: "secret-key-value"
    });
    const readiness = openWebUi.getOpenWebUiReadiness({ isServerless: false });
    assert.equal(readiness.status, "configured");
    assert.equal(JSON.stringify(readiness).includes("secret-key-value"), false, "the key must never be renderable");
    assert.equal(readiness.apiKey, "secret-key-value", "and it must still be usable as a header");
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const key of Object.keys(saved)) delete saved[key];
  });
});
