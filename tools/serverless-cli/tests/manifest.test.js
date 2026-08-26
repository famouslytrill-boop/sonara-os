"use strict";

// What the file is allowed to say, and what happens when it says something else.
//
// The rule these tests hold is that **an unknown setting stops the tool**. A
// loader that ignores what it does not recognise deploys something the author
// did not write and prints nothing, and the author has no way to discover it.

const test = require("node:test");
const assert = require("node:assert/strict");

const { parse } = require("../src/yaml.js");
const { buildApp, ManifestError } = require("../src/manifest.js");

function build(yaml) {
  return buildApp(parse(yaml));
}

function refusal(yaml) {
  try {
    build(yaml);
  } catch (error) {
    if (error instanceof ManifestError) return error;
    throw error;
  }
  return null;
}

const MINIMAL = [
  "name: orders-api",
  "region: eu-west-1",
  "functions:",
  "  checkout:",
  "    handler: handlers/checkout.handler"
].join("\n");

test("builds an application from the smallest file that is one", () => {
  const app = build(MINIMAL);
  assert.equal(app.name, "orders-api");
  assert.equal(app.region, "eu-west-1");
  assert.equal(app.functions.length, 1);
  assert.equal(app.functions[0].handlerFile, "handlers/checkout");
  assert.equal(app.functions[0].handlerExport, "handler");
});

test("applies the documented defaults, and lets a function override them", () => {
  const app = build([
    "name: orders-api",
    "region: eu-west-1",
    "memory: 256",
    "functions:",
    "  small:",
    "    handler: a.handler",
    "  big:",
    "    handler: b.handler",
    "    memory: 2048"
  ].join("\n"));
  const [small, big] = app.functions;
  assert.equal(small.memory, 256, "the top-level default did not reach the function");
  assert.equal(big.memory, 2048, "the function could not override the default");
  assert.equal(small.timeout, 10);
  assert.equal(small.runtime, "nodejs22.x");
});

test("merges shared environment into each function, with the function winning", () => {
  const app = build([
    "name: orders-api",
    "region: eu-west-1",
    "environment:",
    "  STAGE: prod",
    "  TABLE: shared",
    "functions:",
    "  checkout:",
    "    handler: a.handler",
    "    environment:",
    "      TABLE: checkout"
  ].join("\n"));
  assert.deepEqual(app.functions[0].environment, { STAGE: "prod", TABLE: "checkout" });
});

test("reads http and schedule events", () => {
  const app = build([
    "name: orders-api",
    "region: eu-west-1",
    "functions:",
    "  checkout:",
    "    handler: a.handler",
    "    events:",
    "      - http: post /checkout",
    "      - schedule: rate(5 minutes)"
  ].join("\n"));
  assert.deepEqual(app.functions[0].events, [
    { kind: "http", method: "POST", path: "/checkout" },
    { kind: "schedule", expression: "rate(5 minutes)" }
  ]);
  assert.equal(app.hasHttp, true);
});

test("says there is no API when nothing is reachable over HTTP", () => {
  const app = build(MINIMAL);
  assert.equal(app.hasHttp, false, "an API would be created for an application with no routes");
});

test("reads the three resource types", () => {
  const app = build([
    "name: orders-api",
    "region: eu-west-1",
    "resources:",
    "  orders:",
    "    type: table",
    "    key: id",
    "    sort: createdAt",
    "  uploads:",
    "    type: bucket",
    "    versioned: true",
    "  jobs:",
    "    type: queue",
    "functions:",
    "  checkout:",
    "    handler: a.handler",
    "    uses:",
    "      orders: readwrite",
    "      uploads: read"
  ].join("\n"));
  assert.deepEqual(app.resources.map((r) => r.type), ["table", "bucket", "queue"]);
  assert.equal(app.resources[0].sort, "createdAt");
  assert.equal(app.resources[1].versioned, true);
  assert.equal(app.resources[2].visibilityTimeout, 30);
  assert.deepEqual(app.functions[0].uses, { orders: "readwrite", uploads: "read" });
});

// --- the refusals ------------------------------------------------------

test("refuses an unknown top-level setting and suggests the real one", () => {
  const error = refusal(MINIMAL + "\nmemorySize: 1024");
  assert.ok(error, "an unknown setting was ignored, so it would never have taken effect and never been mentioned");
  assert.match(error.message, /"memorySize", which this does not read/);
  assert.match(error.hint, /Did you mean "memory"\?/);
});

test("refuses an unknown function setting", () => {
  const error = refusal([
    "name: orders-api",
    "region: eu-west-1",
    "functions:",
    "  checkout:",
    "    handler: a.handler",
    "    timeoutSeconds: 30"
  ].join("\n"));
  assert.ok(error, "an unknown function setting was ignored");
  assert.match(error.hint, /Did you mean "timeout"\?/);
});

test("lists the valid settings when the key is not a near miss", () => {
  const error = refusal(MINIMAL + "\nqqqqqqqq: 1");
  assert.ok(error);
  assert.match(error.hint, /Settings that can go here: /);
  assert.match(error.hint, /functions/);
});

test("refuses a file with no name and no region", () => {
  assert.match(refusal("region: eu-west-1\nfunctions:\n  a:\n    handler: a.handler").message, /no "name"/);
  assert.match(refusal("name: orders-api\nfunctions:\n  a:\n    handler: a.handler").message, /no "region"/);
});

test("refuses a region that is not shaped like one", () => {
  const error = refusal("name: orders-api\nregion: euwest1\nfunctions:\n  a:\n    handler: a.handler");
  assert.ok(error, "a malformed region was accepted and would have failed at deploy time");
  assert.match(error.message, /not shaped like an AWS region/);
});

test("refuses a file with no functions rather than deploying an empty stack", () => {
  const error = refusal("name: orders-api\nregion: eu-west-1");
  assert.ok(error);
  assert.match(error.message, /declares no functions/);
});

test("refuses a handler that is not a file and an export", () => {
  const error = refusal("name: a\nregion: eu-west-1\nfunctions:\n  b:\n    handler: handlers/checkout");
  assert.ok(error, "a handler with no export name was accepted");
  assert.match(error.message, /not a file and an exported name/);
});

test("refuses a handler that climbs out of the project", () => {
  const error = refusal("name: a\nregion: eu-west-1\nfunctions:\n  b:\n    handler: ../../etc/passwd.handler");
  assert.ok(error, "a handler path escaping the project was accepted");
  assert.match(error.message, /points outside the project/);
});

test("refuses memory outside what AWS accepts, naming the range", () => {
  const error = refusal("name: a\nregion: eu-west-1\nmemory: 99\nfunctions:\n  b:\n    handler: a.handler");
  assert.ok(error, "an out-of-range memory was accepted and would fail at deploy time instead");
  assert.match(error.message, /between 128 and 10240/);
});

test("refuses a timeout that is not a whole number", () => {
  assert.match(refusal("name: a\nregion: eu-west-1\ntimeout: 2.5\nfunctions:\n  b:\n    handler: a.handler").message, /whole number/);
});

test("refuses an unknown runtime rather than passing it through to AWS", () => {
  const error = refusal("name: a\nregion: eu-west-1\nruntime: python3.12\nfunctions:\n  b:\n    handler: a.handler");
  assert.ok(error);
  assert.match(error.message, /not a runtime this sets up/);
});

test("refuses an environment variable with no value", () => {
  const error = refusal([
    "name: a", "region: eu-west-1",
    "environment:",
    "  TABLE:",
    "functions:", "  b:", "    handler: a.handler"
  ].join("\n"));
  assert.ok(error, 'an empty environment variable was deployed as ""');
  assert.match(error.message, /has no value/);
});

test("refuses a resource type it cannot create", () => {
  const error = refusal([
    "name: a", "region: eu-west-1",
    "resources:", "  cache:", "    type: redis",
    "functions:", "  b:", "    handler: a.handler"
  ].join("\n"));
  assert.ok(error, "an unsupported resource type was accepted, and the plan could not have described it");
  assert.match(error.message, /which this does not create/);
  assert.match(error.hint, /table, bucket, queue/);
});

test("refuses a table with no key", () => {
  const error = refusal([
    "name: a", "region: eu-west-1",
    "resources:", "  orders:", "    type: table",
    "functions:", "  b:", "    handler: a.handler"
  ].join("\n"));
  assert.ok(error);
  assert.match(error.message, /table with no "key"/);
});

test("refuses a grant naming a resource that is not in the file", () => {
  const error = refusal([
    "name: a", "region: eu-west-1",
    "resources:", "  orders:", "    type: table", "    key: id",
    "functions:", "  b:", "    handler: a.handler",
    "    uses:", "      ordrs: read"
  ].join("\n"));
  assert.ok(error, "a grant on a non-existent resource was accepted and would have granted nothing");
  assert.match(error.message, /is not a resource in this file/);
  assert.match(error.hint, /Did you mean "orders"\?/);
});

test("refuses a permission level that is not one", () => {
  const error = refusal([
    "name: a", "region: eu-west-1",
    "resources:", "  orders:", "    type: table", "    key: id",
    "functions:", "  b:", "    handler: a.handler",
    "    uses:", "      orders: admin"
  ].join("\n"));
  assert.ok(error);
  assert.match(error.message, /is not a permission level/);
});

test("refuses two functions answering the same route", () => {
  const error = refusal([
    "name: a", "region: eu-west-1",
    "functions:",
    "  one:", "    handler: a.handler", "    events:", "      - http: GET /orders",
    "  two:", "    handler: b.handler", "    events:", "      - http: get /orders"
  ].join("\n"));
  assert.ok(error, "two functions claimed one route, and only one of them would ever be called");
  assert.match(error.message, /Two functions answer "GET \/orders"/);
});

test("refuses an event kind it does not create", () => {
  const error = refusal([
    "name: a", "region: eu-west-1",
    "functions:", "  b:", "    handler: a.handler",
    "    events:", "      - htp: GET /orders"
  ].join("\n"));
  assert.ok(error);
  assert.match(error.hint, /Did you mean "http"\?/);
});

test("refuses a schedule expression AWS would reject", () => {
  const error = refusal([
    "name: a", "region: eu-west-1",
    "functions:", "  b:", "    handler: a.handler",
    "    events:", "      - schedule: every 5 minutes"
  ].join("\n"));
  assert.ok(error, "a schedule AWS rejects was accepted, and would have failed mid-deploy");
  assert.match(error.message, /not a schedule AWS accepts/);
});

test("every refusal says where it is and what to do", () => {
  const error = refusal(MINIMAL + "\nmemorySize: 1024");
  assert.ok(error.where, "the refusal does not say where in the file it is");
  assert.ok(error.hint, "the refusal does not say what to write instead");
});
