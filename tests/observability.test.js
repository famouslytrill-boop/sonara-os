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
const { spawnSync } = require("node:child_process");
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

  it("allows the same plaintext endpoint outside production, in a child process", () => {
    // The other half, and the reason it is not asserted in this process.
    //
    // Outside production that endpoint is accepted, so `startTelemetry`
    // actually starts the SDK -- which registers global trace and metric
    // providers for the whole process and, on shutdown, flushes to an endpoint
    // that is not there. An earlier version of this case did that inline,
    // bounded the flush with a 3s race and unregistered the globals
    // afterwards. It passed standalone in 127ms and passed the full release
    // chain twice, and then **timed out at 15s inside the whole suite** --
    // after several hundred supertest requests have been through `http`, which
    // HttpInstrumentation patches on start.
    //
    // That is the same shape as the audio/mpeg sniffer on 21 September: green
    // most runs, and the run where it is not is expensive to diagnose. So the
    // SDK is started in a child process that is hard-killed on a timeout. A
    // hung flush costs this test and nothing else, and no global provider
    // survives into the rest of the suite because the process holding it is
    // gone.
    //
    // Asserting it matters: without it, the production refusal above is
    // indistinguishable from a URL parser that rejects `http://` everywhere.
    const probe = [
      'const { startTelemetry } = require(' + JSON.stringify(MODULE) + ');',
      'const state = startTelemetry({',
      '  SONARA_OTEL_ENABLED: "true",',
      '  OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector.internal:4318",',
      '  NODE_ENV: "development"',
      '});',
      'process.stdout.write("STATUS=" + state.status + " ENABLED=" + state.enabled);',
      // Nothing is flushed or shut down: the process is about to end, and
      // exiting hard is the point.
      'process.exit(0);'
    ].join("\n");

    const result = spawnSync(process.execPath, ["-e", probe], {
      encoding: "utf8",
      timeout: 20000,
      killSignal: "SIGKILL",
      stdio: ["ignore", "pipe", "pipe"]
    });

    // A killed child says nothing about the rule, so it must not read as a pass.
    assert.equal(result.signal, null, `the probe was killed (${result.signal}); it proved nothing either way`);
    assert.equal(result.status, 0, `the probe exited ${result.status}:\n${result.stderr}`);
    assert.match(
      result.stdout,
      /STATUS=started ENABLED=true/,
      `plaintext OTLP was refused outside production too, so the production rule is really a blanket http rejection: ${result.stdout}`
    );
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
