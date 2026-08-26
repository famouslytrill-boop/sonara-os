"use strict";

// The local runner, tested by running handlers.
//
// The promise `dev` makes is narrow and worth keeping: a handler that answers
// here answers the same way in production. So these tests write real handler
// files to disk, start the real server, and make real HTTP requests -- a mocked
// invocation would test that this file calls itself.
//
// The event shape is the part most worth pinning. API Gateway's HTTP API sends
// payload format 2.0, and a handler written against a hand-rolled `{ path }`
// object runs locally and fails in production on `event.requestContext`.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { parse } = require("../src/yaml.js");
const { buildApp } = require("../src/manifest.js");
const { serve, buildEvent, toResponse, matchRoute } = require("../src/dev.js");

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-dev-"));
  for (const [name, contents] of Object.entries(files)) {
    const full = path.join(root, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return root;
}

async function withServer(yaml, files, run) {
  const root = project(files);
  const server = await serve(buildApp(parse(yaml)), { projectRoot: root, port: 0 });
  try {
    return await run(server, root);
  } finally {
    await server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const YAML = [
  "name: local-app",
  "region: eu-west-1",
  "environment:",
  "  STAGE: local",
  "functions:",
  "  hello:",
  "    handler: handlers/hello.handler",
  "    events:",
  "      - http: GET /hello",
  "  echo:",
  "    handler: handlers/echo.handler",
  "    events:",
  "      - http: POST /echo",
  "  one:",
  "    handler: handlers/one.handler",
  "    events:",
  "      - http: GET /orders/{id}"
].join("\n");

const HANDLERS = {
  "handlers/hello.js": `exports.handler = async () => ({ statusCode: 200, body: JSON.stringify({ hello: "world" }) });\n`,
  "handlers/echo.js": `exports.handler = async (event) => ({ statusCode: 201, body: JSON.stringify({ got: event.body, version: event.version, method: event.requestContext.http.method }) });\n`,
  "handlers/one.js": `exports.handler = async (event) => ({ statusCode: 200, body: JSON.stringify({ id: event.pathParameters.id, stage: process.env.STAGE }) });\n`
};

test("serves a route by invoking the handler that declared it", async () => {
  await withServer(YAML, HANDLERS, async (server) => {
    const response = await fetch(`${server.url}/hello`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { hello: "world" });
  });
});

test("hands the handler a payload format 2.0 event, not an invented one", async () => {
  await withServer(YAML, HANDLERS, async (server) => {
    const response = await fetch(`${server.url}/echo`, { method: "POST", body: "the body" });
    const answered = await response.json();
    assert.equal(response.status, 201);
    assert.equal(answered.got, "the body");
    assert.equal(answered.version, "2.0", "the event is not payload format 2.0, so a handler reading it would break in production");
    assert.equal(answered.method, "POST", "requestContext.http.method is missing, and handlers read it constantly");
  });
});

test("passes path parameters and the function's environment", async () => {
  await withServer(YAML, HANDLERS, async (server) => {
    const answered = await (await fetch(`${server.url}/orders/abc-123`)).json();
    assert.equal(answered.id, "abc-123");
    assert.equal(answered.stage, "local", "the function's environment was not set for the call");
  });
});

test("puts the environment back after the call rather than leaving it set", async () => {
  const before = process.env.STAGE;
  await withServer(YAML, HANDLERS, async (server) => {
    await fetch(`${server.url}/hello`);
  });
  assert.equal(process.env.STAGE, before,
    "one function's environment was left set, so the next function invoked would see it");
});

test("runs a TypeScript handler with no build step", async () => {
  // Node 22 strips types natively. This is the whole reason a TypeScript path
  // can exist here without the tool acquiring a bundler.
  const yaml = [
    "name: ts-app", "region: eu-west-1",
    "functions:", "  typed:", "    handler: handlers/typed.handler",
    "    events:", "      - http: GET /typed"
  ].join("\n");
  const files = {
    "handlers/typed.ts":
      "interface Reply { ok: boolean; count: number }\n"
      + "export const handler = async (): Promise<{ statusCode: number; body: string }> => {\n"
      + "  const reply: Reply = { ok: true, count: 41 + 1 };\n"
      + "  return { statusCode: 200, body: JSON.stringify(reply) };\n"
      + "};\n"
  };
  await withServer(yaml, files, async (server) => {
    const response = await fetch(`${server.url}/typed`);
    assert.equal(response.status, 200, "the TypeScript handler did not run");
    assert.deepEqual(await response.json(), { ok: true, count: 42 });
  });
});

test("picks up an edit without a restart", async () => {
  await withServer(YAML, HANDLERS, async (server, root) => {
    assert.deepEqual(await (await fetch(`${server.url}/hello`)).json(), { hello: "world" });
    fs.writeFileSync(
      path.join(root, "handlers/hello.js"),
      `exports.handler = async () => ({ statusCode: 200, body: JSON.stringify({ hello: "again" }) });\n`
    );
    assert.deepEqual(await (await fetch(`${server.url}/hello`)).json(), { hello: "again" },
      "the edited handler was not reloaded, so every change needs a restart");
  });
});

test("answers 404 with the routes there are, rather than only a refusal", async () => {
  await withServer(YAML, HANDLERS, async (server) => {
    const response = await fetch(`${server.url}/nope`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.ok(body.routes.includes("GET /hello"), "the 404 does not say which routes exist");
  });
});

test("answers 502 when a handler throws, the way API Gateway does", async () => {
  await withServer(
    "name: a\nregion: eu-west-1\nfunctions:\n  bad:\n    handler: handlers/bad.handler\n    events:\n      - http: GET /bad",
    { "handlers/bad.js": `exports.handler = async () => { throw new Error("deliberate"); };\n` },
    async (server) => {
      const response = await fetch(`${server.url}/bad`);
      assert.equal(response.status, 502, "a throwing handler did not answer the way API Gateway does");
      assert.match((await response.json()).detail, /deliberate/);
    }
  );
});

test("says where it looked when the handler file is missing", async () => {
  await withServer(
    "name: a\nregion: eu-west-1\nfunctions:\n  gone:\n    handler: handlers/gone.handler\n    events:\n      - http: GET /gone",
    { "handlers/other.js": "exports.handler = async () => 1;\n" },
    async (server) => {
      const response = await fetch(`${server.url}/gone`);
      assert.equal(response.status, 502);
      assert.match((await response.json()).detail, /Could not find the file/);
    }
  );
});

test("says which functions the file does export when the name is wrong", async () => {
  await withServer(
    "name: a\nregion: eu-west-1\nfunctions:\n  typo:\n    handler: handlers/typo.handlr\n    events:\n      - http: GET /t",
    { "handlers/typo.js": "exports.handler = async () => 1;\n" },
    async (server) => {
      const detail = (await (await fetch(`${server.url}/t`)).json()).detail;
      assert.match(detail, /does not export a function called "handlr"/);
    }
  );
});

// --- the pure pieces ---------------------------------------------------

test("builds an event with the fields handlers actually reach for", () => {
  const event = buildEvent({
    method: "GET", url: "/orders?status=open&status=new",
    headers: { "user-agent": "test" }, body: null, routeKey: "GET /orders"
  });
  assert.equal(event.version, "2.0");
  assert.equal(event.rawPath, "/orders");
  assert.equal(event.rawQueryString, "status=open&status=new");
  assert.equal(event.queryStringParameters.status, "open,new",
    "repeated query parameters must be comma-joined, which is what format 2.0 does");
  assert.equal(event.requestContext.http.method, "GET");
  assert.equal(event.requestContext.stage, "$default");
});

test("accepts the three shapes API Gateway accepts", () => {
  assert.equal(toResponse({ statusCode: 204, body: "" }).status, 204);
  assert.equal(toResponse("plain").status, 200);
  assert.match(toResponse("plain").headers["content-type"], /text\/plain/);
  assert.equal(toResponse({ a: 1 }).body, '{"a":1}');
  assert.equal(toResponse(undefined).status, 200);
});

test("does not overwrite a content-type the handler chose", () => {
  const response = toResponse({ statusCode: 200, headers: { "Content-Type": "text/csv" }, body: "a,b" });
  assert.equal(response.headers["Content-Type"], "text/csv");
  assert.ok(!response.headers["content-type"], "a second content-type header was added alongside the handler's own");
});

test("matches a literal route before a parameterised one it also fits", () => {
  const routes = [
    { method: "GET", path: "/orders/{id}", fn: { name: "one" } },
    { method: "GET", path: "/orders/new", fn: { name: "new" } }
  ];
  // Declaration order decides, and the manifest preserves the file's order --
  // so what somebody wrote first wins, which is at least predictable.
  assert.equal(matchRoute(routes, "GET", "/orders/abc").route.fn.name, "one");
  assert.equal(matchRoute(routes, "GET", "/orders/new").route.fn.name, "one");
});

test("matches a greedy proxy route", () => {
  const routes = [{ method: "GET", path: "/files/{proxy+}", fn: { name: "files" } }];
  const matched = matchRoute(routes, "GET", "/files/a/b/c.txt");
  assert.equal(matched.parameters.proxy, "a/b/c.txt");
});

test("does not match a route of a different method", () => {
  const routes = [{ method: "POST", path: "/orders", fn: { name: "a" } }];
  assert.equal(matchRoute(routes, "GET", "/orders"), null);
});
