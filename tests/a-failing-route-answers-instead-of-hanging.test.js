"use strict";

// Express 4 ignores the promise an async handler returns. If the handler
// throws, or awaits something that rejects, nothing calls `next(error)` and
// nothing writes a response: the request stays open until the client gives up.
// This application has 225 async handlers.
//
// It was found from the other end. docs/SHIP_READINESS.md carried an open,
// undiagnosed finding about /admin/database stalling on a healthy catalog. The
// mechanism is this one, and it is not a property of that route.
//
// A stall is worse than a 500 in three distinct ways, which is why it earned a
// fix at registration rather than a try/catch in the handler somebody noticed:
// a customer sees a spinner rather than an error and retries instead of
// reporting; a serverless function is billed until its own timeout rather than
// until the failure; and here it landed on the page an owner opens when they
// already believe something is wrong.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const { installAsyncRouteSafety, createAsyncErrorHandler } = require("../lib/sonara-async-route-safety.cjs");
const app = require("../server");

const WRAPPED = Symbol.for("sonara.asyncRouteSafety.wrapped");

// Long enough that a slow render is not mistaken for a stall, short enough that
// a stall does not become a mocha timeout -- a timeout would report this as a
// broken test rather than as the behaviour under test.
const DEADLINE_MS = 3000;

function race(agent) {
  return Promise.race([
    agent.then((res) => ({ status: res.status, text: String(res.text || "") })),
    new Promise((resolve) => setTimeout(() => resolve({ status: "stalled", text: "" }), DEADLINE_MS))
  ]);
}

// A fresh Express 4 app rather than the real one, because the question is what
// the framework does with a throwing handler and the real app has no route that
// throws on purpose -- adding one to it would be adding the defect.
function buildApp({ install }) {
  const probe = express();
  if (install) installAsyncRouteSafety(probe);
  probe.get("/page", async () => { throw new Error("probe failure"); });
  probe.get("/api/thing", async () => { throw new Error("probe failure"); });
  probe.get("/sync", () => { throw new Error("probe failure"); });
  probe.get("/already-sent", async (req, res) => {
    res.status(200).type("html").send("<p>the real answer</p>");
    throw new Error("probe failure after the response");
  });
  if (install) probe.use(createAsyncErrorHandler({ renderHtml: () => "<h1>Something went wrong</h1>" }));
  return probe;
}

describe("a failing route answers instead of hanging", () => {
  // Without this, the four assertions below could all pass against a framework
  // that never had the problem, and this file would be documentation wearing a
  // green tick. The defect is asserted first, on the same construction.
  it("hangs without the safety net, which is the thing being fixed", async () => {
    const result = await race(request(buildApp({ install: false })).get("/page"));
    assert.equal(result.status, "stalled", "Express 4 answered a throwing async handler; this test's premise is gone and the rest of it proves nothing.");
  });

  it("answers an async failure with a page rather than silence", async () => {
    const result = await race(request(buildApp({ install: true })).get("/page"));
    assert.equal(result.status, 500);
    assert.match(result.text, /Something went wrong/);
  });

  it("answers an API failure with JSON, since a caller cannot parse a page", async () => {
    const result = await race(request(buildApp({ install: true })).get("/api/thing"));
    assert.equal(result.status, 500);
    assert.equal(JSON.parse(result.text).code, "request_failed");
  });

  it("says nothing about what failed", async () => {
    const result = await race(request(buildApp({ install: true })).get("/page"));
    assert.doesNotMatch(result.text, /probe failure/, "the error message reached the customer");
    assert.doesNotMatch(result.text, /sonara-async-route-safety|at Object|\.cjs:/, "a stack trace reached the customer");
  });

  it("catches a synchronous throw too", async () => {
    const result = await race(request(buildApp({ install: true })).get("/sync"));
    assert.equal(result.status, 500);
  });

  it("leaves a response that already went out alone", async () => {
    // Overwriting it is not possible and pretending otherwise is worse than the
    // stall: the customer would get a 500 over work that succeeded.
    const result = await race(request(buildApp({ install: true })).get("/already-sent"));
    assert.equal(result.status, 200);
    assert.match(result.text, /the real answer/);
  });
});

describe("the safety net is actually installed on this application", () => {
  // The suite above proves the module works. This one proves server.js uses it,
  // which is the half a module test cannot see and the half that matters.
  it("patched the application before any route was registered", () => {
    assert.equal(app[WRAPPED], true, "server.js never called installAsyncRouteSafety");
  });

  it("wrapped the handlers that are actually registered", () => {
    const routeLayers = app._router.stack.filter((layer) => layer.route);
    assert.ok(routeLayers.length > 200, `only ${routeLayers.length} route layers found; this check is measuring the wrong thing`);
    const unwrapped = routeLayers.filter((layer) => layer.route.stack.some((entry) => !entry.handle[WRAPPED]));
    assert.deepEqual(
      unwrapped.map((layer) => layer.route.path),
      [],
      "these routes were registered without the safety net, so a throw in them still hangs"
    );
  });

  it("ends with an error handler, after the 413 one", () => {
    const errorLayers = app._router.stack.filter((layer) => !layer.route && layer.handle.length === 4);
    assert.ok(errorLayers.length >= 2, "expected the payload-size handler and the terminal handler");
    assert.equal(
      errorLayers[errorLayers.length - 1].handle.name,
      "sonaraAsyncErrorHandler",
      "the terminal error handler is not last, so an error can reach Express's default and answer with a stack trace"
    );
  });
});
