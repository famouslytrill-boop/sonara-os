"use strict";

// One port, every service.
//
// The whole point of the shape: an SDK or the AWS CLI is pointed at
// `http://localhost:4566` with `--endpoint-url`, and everything it asks for
// arrives here. `protocol.js` works out which service each request is for and
// `services/index.js` either answers it or refuses it by name.
//
// ## Signatures are read and not verified, deliberately
//
// Every request's `Authorization` header is parsed -- that is how the service
// is identified -- and the signature itself is never checked.
//
// It would be easy to check, and it would make this worse. Locally there is
// nothing to protect: the credentials are `test`/`test` by convention, the data
// is throwaway, and the port is on the machine. What signature verification
// would add is a class of failure that has nothing to do with the code under
// test -- a clock an hour out, a proxy that reordered a header, an SDK version
// that signs a payload differently -- each surfacing as a 403 that looks like a
// permissions bug in the caller's own application.
//
// The README says this in one line, because somebody has to be able to find out
// without reading the source: **this emulator does not authenticate anything.
// Do not put it on a network you do not control.** It binds to 0.0.0.0 inside a
// container because that is the only way the port maps out, which makes saying
// so more important rather than less.

const http = require("node:http");
const { identify } = require("./protocol.js");
const { dispatch, IMPLEMENTED, NOT_IMPLEMENTED } = require("./services/index.js");
const { Store } = require("./store.js");

const DEFAULT_PORT = 4566;

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    // 128MB. A Lambda package is the big one; past this something is wrong and
    // buffering it would take the container down instead.
    const limit = 128 * 1024 * 1024;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > limit) {
        reject(Object.assign(new Error("request body over 128MB"), { tooLarge: true }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

/**
 * Build the server.
 *
 * Returned rather than started, so a test can listen on port 0 and run several
 * at once. `start()` is what the container calls.
 */
function createServer({ store = new Store(), log = (line) => process.stdout.write(`${line}\n`), quiet = false } = {}) {
  const say = quiet ? () => {} : log;

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      res.writeHead(error.tooLarge ? 413 : 400, { "content-type": "text/plain" });
      res.end(error.tooLarge ? "Request body over 128MB.\n" : "Could not read the request body.\n");
      return;
    }

    // The emulator's own endpoints, under a prefix no AWS service uses.
    if (url.pathname.startsWith("/_emulator")) {
      return emulatorEndpoint(url, req, res, { store, say });
    }

    const request = {
      method: req.method,
      path: url.pathname,
      query: url.searchParams,
      headers: req.headers,
      body
    };

    let answer;
    try {
      const identified = identify({
        method: req.method,
        path: url.pathname,
        headers: req.headers,
        body: body.toString("utf8").slice(0, 4096),
        query: url.searchParams
      });
      answer = dispatch({ ...request, ...identified }, { store, log: say });
      // A handler that returns nothing is a bug in this emulator, and it must
      // not become a hanging request -- which is what an unanswered response
      // is, and the hardest thing to debug from the other end.
      if (!answer) throw new Error(`the ${identified.service} handler returned nothing`);
    } catch (error) {
      say(`aws-emulator: ${req.method} ${url.pathname} failed: ${error.stack || error.message}`);
      res.writeHead(500, { "content-type": "application/xml" });
      res.end(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>InternalError</Code>`
        + `<Message>This emulator threw handling the request. That is a bug in the emulator rather than in your code: `
        + `${String(error.message).replace(/[<>&]/g, "")}</Message></Error>`);
      return;
    }

    const headers = { ...(answer.headers || {}) };
    const payload = Buffer.isBuffer(answer.body) ? answer.body : Buffer.from(String(answer.body || ""), "utf8");
    if (!Object.keys(headers).some((name) => name.toLowerCase() === "content-length")) {
      headers["content-length"] = String(payload.length);
    }
    headers["x-amzn-requestid"] = `emulator-${started}`;

    res.writeHead(answer.status || 200, headers);
    res.end(req.method === "HEAD" ? undefined : payload);
  });

  return server;
}

// `/_emulator/...` -- this emulator's own controls, on a prefix no AWS service
// uses so it cannot collide with something being emulated.
function emulatorEndpoint(url, req, res, { store, say }) {
  const json = (status, payload) => {
    const body = JSON.stringify(payload, null, 2);
    res.writeHead(status, { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) });
    res.end(body);
  };

  if (url.pathname === "/_emulator/health") {
    return json(200, {
      ok: true,
      // What it can do, from the registry rather than from a list written here.
      // A README can drift; this cannot.
      implemented: Object.keys(IMPLEMENTED).sort(),
      notImplemented: Object.keys(NOT_IMPLEMENTED).sort(),
      authenticates: false,
      evaluatesIamPolicies: false,
      persists: Boolean(store.directory),
      state: store.counts()
    });
  }

  if (url.pathname === "/_emulator/reset" && req.method === "POST") {
    store.clear();
    say("aws-emulator: state cleared");
    return json(200, { ok: true, cleared: true });
  }

  return json(404, {
    ok: false,
    message: "This emulator answers /_emulator/health and POST /_emulator/reset."
  });
}

function banner(port, store) {
  const implemented = Object.keys(IMPLEMENTED).sort().join(", ");
  return [
    "",
    `  aws-emulator on http://localhost:${port}`,
    "",
    `  implemented      ${implemented}`,
    `  not implemented  everything else -- each refuses by name rather than answering`,
    "",
    `  state            ${store.directory ? `persisted in ${store.directory}` : "in memory, cleared when this stops"}`,
    // Said at startup, every time, because it is the one thing somebody must
    // not discover later.
    "  security         no authentication, no IAM policy evaluation. Do not expose this port.",
    "",
    "  point a tool at it:",
    `    aws --endpoint-url http://localhost:${port} s3 ls`,
    ""
  ].join("\n");
}

function start({ port = Number(process.env.AWS_EMULATOR_PORT) || DEFAULT_PORT, stateDir = process.env.AWS_EMULATOR_STATE_DIR || null } = {}) {
  const store = new Store({ directory: stateDir });
  const server = createServer({ store });
  server.listen(port, "0.0.0.0", () => {
    process.stdout.write(banner(port, store));
  });
  return { server, store };
}

module.exports = { createServer, start, banner, DEFAULT_PORT };

if (require.main === module) start();
