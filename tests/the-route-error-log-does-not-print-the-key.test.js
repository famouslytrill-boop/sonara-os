"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createAsyncErrorHandler } = require("../lib/sonara-async-route-safety.cjs");

const root = path.join(__dirname, "..");

// Every unhandled route error in this application ends up in one log line.
//
// That line interpolated `error.stack` raw. lib/sonara-redaction.cjs was written
// for exactly this carrier and says so in its own header: "a Supabase failure
// carries a URL with an apikey query parameter ... redactError() exists because
// an Error is the usual carrier and `String(error)` drops the stack while
// `error.stack` keeps the URL that failed."
//
// So the redactor existed, the hazard was documented, and the one sink every
// route error passes through did not call it. A failed PostgREST request prints
// the service-role key -- the single worst thing in this deployment to print --
// on the path taken when something is already going wrong, which is also the
// path most likely to be pasted into a chat while somebody asks for help.
//
// The request line is scrubbed separately: a URL can carry a token in its query
// string, and a shared-result link does.

const SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role-payload-value.signature-value-here";

function handlerCapturing(lines) {
  return createAsyncErrorHandler({ log: (message) => lines.push(String(message)) });
}

function request(overrides = {}) {
  return {
    method: "GET",
    originalUrl: "/api/invoices",
    path: "/api/invoices",
    get: () => "application/json",
    ...overrides
  };
}

function response() {
  return {
    headersSent: false,
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    setHeader() {},
    type() { return this; }
  };
}

describe("the route error log does not print the key", () => {
  it("redacts a service-role key carried in a failed request URL", () => {
    const lines = [];
    const error = new Error(`fetch failed https://project.supabase.co/rest/v1/invoices?apikey=${SERVICE_ROLE}&select=*`);
    handlerCapturing(lines)(error, request(), response(), () => {});

    assert.equal(lines.length, 1, `expected one log line, got ${lines.length}`);
    assert.ok(!lines[0].includes(SERVICE_ROLE), "the service-role key reached the log");
    assert.ok(!/apikey=eyJ/.test(lines[0]), "an apikey query parameter reached the log with its value");
  });

  it("redacts a token carried in the request URL itself", () => {
    const lines = [];
    handlerCapturing(lines)(new Error("boom"), request({ originalUrl: `/shared/result?apikey=${SERVICE_ROLE}` }), response(), () => {});
    assert.ok(!lines[0].includes(SERVICE_ROLE), "a credential in the request URL reached the log");
  });

  it("still says which request failed, or the log is useless", () => {
    // A redactor that removes everything is as useless as one that removes
    // nothing, and only the second failure is obvious.
    const lines = [];
    handlerCapturing(lines)(new Error("boom"), request(), response(), () => {});
    assert.match(lines[0], /\[route-error\]/);
    assert.match(lines[0], /GET/);
    assert.match(lines[0], /\/api\/invoices/);
    assert.match(lines[0], /boom/, "the error message was scrubbed away along with the secret");
  });

  it("calls the redactor rather than relying on the message happening to be clean", () => {
    const source = fs.readFileSync(path.join(root, "lib", "sonara-async-route-safety.cjs"), "utf8");
    assert.match(source, /redactError\(/, "the handler no longer redacts the error");
    assert.match(source, /redactSensitiveText\(/, "the handler no longer redacts the request line");
    assert.doesNotMatch(
      source,
      /\$\{error && error\.stack \? error\.stack : error\}/,
      "the raw stack is being interpolated into the log again"
    );
  });

  it("answers the customer without the stack, whatever it logs", () => {
    const response_ = response();
    handlerCapturing([])(new Error(`leak ${SERVICE_ROLE}`), request(), response_, () => {});
    assert.equal(response_.statusCode, 500);
    assert.ok(!JSON.stringify(response_.body || {}).includes(SERVICE_ROLE), "the key reached the customer's response body");
  });
});
