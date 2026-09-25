// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What the telemetry boundary decides, and what it records when it runs.
//
// This file used to hold one assertion: telemetry is disabled unless enabled.
// That left `lib/sonara-observability.cjs` at 13.8% covered (19 of 138 lines),
// which failed `verify:coverage-floor` on `main` on 21 September 2026 --
// masked, until the count ahead of it was fixed, by `verify:proprietary-notice`
// failing first.
//
// ## Why a second assertion could not simply be added
//
// `startTelemetry` memoises: `if (telemetryState.status !== "not_started")
// return telemetryState`. The first call in a process decides for the whole
// process, so a second `it` calling it with different environment would have
// received the FIRST call's answer and asserted against that. It would have
// passed, and it would have been measuring nothing -- the shape this
// repository keeps finding.
//
// So each case takes a fresh module instance out of the require cache, and
// `freshModule()` asserts the instance really is fresh before using it. If the
// cache key ever stops matching, these tests stop rather than quietly going
// back to measuring one memoised decision.

const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");
// Imported rather than taken as a global: eslint.config.mjs does not list
// setImmediate among the Node globals, and widening a shared lint config for
// one test file is the wrong direction.
const { setImmediate: onceQueueDrains } = require("node:timers");
// Patched for one case below, to prove the endpoint decision without
// constructing the OpenTelemetry SDK. Restored in that case's `finally`.
const Module = require("node:module");
const request = require("supertest");

const MODULE = path.join(__dirname, "..", "lib", "sonara-observability.cjs");

function freshModule() {
  delete require.cache[require.resolve(MODULE)];
  const loaded = require(MODULE);
  // The guard that makes every case below mean something.
  assert.equal(
    loaded.currentTelemetryState().status,
    "not_started",
    "the module came back memoised, so this case would assert a previous case's decision"
  );
  return loaded;
}

// The module calls emitEvent without a sink, and emitEvent defaults to stderr.
function captureStderr(run) {
  const lines = [];
  const original = process.stderr.write;
  process.stderr.write = (chunk, ...rest) => {
    lines.push(String(chunk));
    if (typeof rest[rest.length - 1] === "function") rest[rest.length - 1]();
    return true;
  };
  try {
    return { value: run(), lines };
  } finally {
    process.stderr.write = original;
  }
}

// The `finish` handler runs after the response promise resolves, so a capture
// that restores stderr synchronously is restored before the event it wanted.
// The first version of this file did exactly that and reported zero events.
async function captureStderrUntilSettled(run) {
  const lines = [];
  const original = process.stderr.write;
  process.stderr.write = (chunk, ...rest) => {
    lines.push(String(chunk));
    const last = rest[rest.length - 1];
    if (typeof last === "function") last();
    return true;
  };
  try {
    const value = await run();
    await new Promise((resolve) => onceQueueDrains(resolve));
    return { value, lines };
  } finally {
    process.stderr.write = original;
  }
}

describe("OpenTelemetry production boundary", () => {
  it("is disabled unless explicitly enabled", () => {
    const { startTelemetry, currentTelemetryState } = freshModule();
    const state = startTelemetry({ NODE_ENV: "test" });
    assert.equal(state.enabled, false);
    assert.equal(state.status, "disabled");
    assert.deepEqual(currentTelemetryState(), { enabled: false, status: "disabled" });
  });

  it("treats anything but the string true as not enabled", () => {
    for (const value of ["1", "yes", "TRUE ", "", "false", undefined]) {
      const { startTelemetry } = freshModule();
      const state = startTelemetry({ NODE_ENV: "test", SONARA_OTEL_ENABLED: value });
      // " TRUE " trims and lowercases to true, so it is deliberately excluded
      // above; everything here must read as off.
      assert.equal(state.enabled, false, `SONARA_OTEL_ENABLED=${JSON.stringify(value)} enabled telemetry`);
    }
  });

  it("refuses to start when enabled with no endpoint configured", () => {
    const { startTelemetry } = freshModule();
    const { value, lines } = captureStderr(() => startTelemetry({ NODE_ENV: "test", SONARA_OTEL_ENABLED: "true" }));
    assert.equal(value.enabled, false);
    assert.equal(value.status, "invalid_configuration");
    assert.equal(value.sdk, null);
    // Refusing quietly would be a process with no telemetry and no reason why.
    const event = JSON.parse(lines.find((line) => line.includes("observability.otel_start")));
    assert.equal(event.outcome, "refused");
    assert.equal(event.reason, "invalid_or_missing_otlp_endpoint");
    assert.equal(event.detail.traces_configured, false);
  });

  it("refuses a plaintext endpoint in production", () => {
    const refused = freshModule();
    const state = captureStderr(() => refused.startTelemetry({
      SONARA_OTEL_ENABLED: "true",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector.internal:4318",
      NODE_ENV: "production"
    })).value;
    assert.equal(state.status, "invalid_configuration", "plaintext OTLP was accepted in production");
    assert.equal(state.enabled, false);
  });

  it("allows the same plaintext endpoint outside production", () => {
    // The other half, and the third attempt at it. Without this assertion,
    // "plaintext OTLP is refused in production" is indistinguishable from a URL
    // parser that rejects `http://` everywhere -- so it is worth having. What it
    // is not worth is starting the SDK.
    //
    // Attempt 1 started the real SDK inline, bounded the shutdown flush and
    // unregistered the globals afterwards. 127ms standalone, green in the
    // release chain twice, then **timed out at 15s inside the whole suite**:
    // HttpInstrumentation patches `http` on start, and by the time this file
    // runs several hundred supertest requests have been through it.
    //
    // Attempt 2 moved the SDK start into a hard-killed child process. That
    // timed out too, and for a reason of my own making: the child's timeout was
    // 20s against mocha's 15s per-test limit, so mocha killed the test before
    // the child's own guard could fire. Raising one number would have papered
    // over the real problem, which is that the SDK has no business starting in
    // a test at all.
    //
    // This proves the decision instead. The endpoint check happens before the
    // SDK is constructed, so blocking `@opentelemetry/sdk-node` from loading
    // sends `startTelemetry` down its catch path: `start_failed` rather than
    // `invalid_configuration`. That difference IS the property -- the plaintext
    // endpoint was accepted outside production and the start failed afterwards,
    // for the reason this test arranged. 7ms, no network, no global provider,
    // nothing to clean up.
    const blocked = "@opentelemetry/sdk-node";
    const original = Module.prototype.require;
    let state;
    try {
      Module.prototype.require = function patched(id) {
        if (String(id).startsWith(blocked)) throw new Error(`${blocked} blocked by this test`);
        return original.apply(this, arguments);
      };
      const { startTelemetry } = freshModule();
      state = captureStderr(() => startTelemetry({
        SONARA_OTEL_ENABLED: "true",
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector.internal:4318",
        NODE_ENV: "development"
      })).value;
    } finally {
      // In-process and synchronous, so this `finally` is enough -- unlike one
      // guarding a tracked file, which a signal can skip.
      Module.prototype.require = original;
    }

    assert.notEqual(
      state.status,
      "invalid_configuration",
      "plaintext OTLP was refused outside production too, so the production rule is really a blanket http rejection"
    );
    // And the reason it did not start is the one this test arranged, not some
    // other refusal that would make the assertion above pass for free.
    assert.equal(state.status, "start_failed");
    assert.equal(state.enabled, false);
    assert.equal(state.sdk, null);

    // The guard is real: without the block, the same call starts the SDK. Left
    // as an assertion on the patch rather than a second live start.
    assert.equal(Module.prototype.require, original, "the require patch outlived the case that installed it");
  });

  it("redacts credentials from OpenTelemetry startup failures", () => {
    const original = Module.prototype.require;
    const secret = "eyJabcdefghijk.abcdefghijk.abcdefghijk";
    let lines = [];
    try {
      Module.prototype.require = function patched(id) {
        if (String(id).startsWith("@opentelemetry/sdk-node")) {
          throw new Error(`failed exporter authorization: Bearer ${secret}`);
        }
        return original.apply(this, arguments);
      };
      const { startTelemetry } = freshModule();
      lines = captureStderr(() => startTelemetry({
        SONARA_OTEL_ENABLED: "true",
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector.internal:4318",
        NODE_ENV: "development"
      })).lines;
    } finally {
      Module.prototype.require = original;
    }

    const event = JSON.parse(lines.find((line) => line.includes("observability.otel_start")));
    assert.equal(event.outcome, "failed");
    assert.equal(event.reason, "sdk_start_failed");
    assert.equal(event.detail.error.includes(secret), false);
    assert.match(event.detail.error, /\[redacted-(?:jwt|credential)\]/);
  });

  it("refuses an endpoint that is not a URL at all", () => {
    const { startTelemetry } = freshModule();
    const state = captureStderr(() =>
      startTelemetry({ NODE_ENV: "test", SONARA_OTEL_ENABLED: "true", OTEL_EXPORTER_OTLP_ENDPOINT: "collector:4318" })
    ).value;
    assert.equal(state.status, "invalid_configuration");
  });

  it("requires both signals, not just traces", () => {
    // endpointFor falls back to the base endpoint per signal, so a traces-only
    // configuration leaves metrics unconfigured and must not half-start.
    const { startTelemetry } = freshModule();
    const state = captureStderr(() =>
      startTelemetry({
        NODE_ENV: "test",
        SONARA_OTEL_ENABLED: "true",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://collector.example/v1/traces"
      })
    ).value;
    assert.equal(state.status, "invalid_configuration");
  });
});

describe("HTTP observability middleware", () => {
  function appWith() {
    const { installHttpObservability } = freshModule();
    const app = express();
    installHttpObservability(app);
    app.get("/health", (req, res) => res.json({ ok: true, correlation: req.sonaraCorrelationId }));
    app.get("/boom", (req, res) => res.status(503).json({ ok: false }));
    app.get("/denied", (req, res) => res.status(403).json({ ok: false }));
    app.get("/asset.js", (req, res) => res.type("js").send("// asset"));
    return app;
  }

  it("refuses anything that is not an Express app", () => {
    const { installHttpObservability } = freshModule();
    assert.throws(() => installHttpObservability(null), /requires an Express app/);
    assert.throws(() => installHttpObservability({}), /requires an Express app/);
  });

  it("gives every dynamic request a correlation id the caller can see", async () => {
    const app = appWith();
    const { value: response } = await captureStderrUntilSettled(() => request(app).get("/health"));
    assert.equal(response.status, 200);
    assert.match(response.headers["x-request-id"], /^[0-9a-f-]{36}$/);
    // The header and the id the handler read must be the same value, or a
    // customer quoting the header names a request nothing logged under it.
    assert.equal(response.body.correlation, response.headers["x-request-id"]);
  });

  it("records the status class rather than only the code", async () => {
    const app = appWith();
    for (const [route, status, statusClass, outcome] of [
      ["/health", 200, "2xx", "ok"],
      ["/denied", 403, "4xx", "refused"],
      ["/boom", 503, "5xx", "failed"]
    ]) {
      const { lines } = await captureStderrUntilSettled(() => request(app).get(route));
      const emitted = lines.map((line) => line.trim()).filter((line) => line.includes('"http.request"'));
      assert.equal(emitted.length, 1, `${route} emitted ${emitted.length} http.request events`);
      const event = JSON.parse(emitted[0]);
      assert.equal(event.detail.status, status);
      assert.equal(event.reason, statusClass);
      assert.equal(event.outcome, outcome);
      assert.equal(event.detail.route, route);
      assert.equal(event.scope, "process", "no organization was resolved, so the event must not claim one");
      assert.equal(typeof event.detail.duration_ms, "number");
    }
  });

  it("does not count versioned static assets", async () => {
    const app = appWith();
    const { lines } = await captureStderrUntilSettled(() => request(app).get("/asset.js"));
    assert.deepEqual(
      lines.filter((line) => line.includes('"http.request"')),
      [],
      "a static asset was counted; that is what makes customer transactions hard to see"
    );
  });

  it("names the organization when the request carries one", async () => {
    const { installHttpObservability } = freshModule();
    const app = express();
    app.use((req, res, next) => {
      req.sonaraAccess = { organizationId: "11111111-1111-4111-8111-111111111111" };
      next();
    });
    installHttpObservability(app);
    app.get("/records", (req, res) => res.json({ ok: true }));

    const { lines } = await captureStderrUntilSettled(() => request(app).get("/records"));
    const event = JSON.parse(lines.find((line) => line.includes('"http.request"')));
    assert.equal(event.scope, "organization");
    assert.equal(event.organization, "11111111-1111-4111-8111-111111111111");
  });

  it("reports an unmatched path as unmatched rather than as itself", async () => {
    const app = appWith();
    const { lines } = await captureStderrUntilSettled(() => request(app).get("/no-such-route"));
    const event = JSON.parse(lines.find((line) => line.includes('"http.request"')));
    // A route template is a bounded label. Logging the raw path would let a
    // caller mint unbounded metric attributes by varying the URL.
    assert.equal(event.detail.route, "unmatched");
    assert.equal(event.detail.status, 404);
  });
});
