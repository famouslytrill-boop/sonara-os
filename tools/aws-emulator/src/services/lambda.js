"use strict";

// Lambda.
//
// This one actually runs code, which makes it the most useful service here and
// the one with the sharpest limits. Both are worth stating before the API.
//
// ## What it does
//
// A function's zip is unpacked to a temporary directory and its handler is
// invoked in a **separate Node process**, with the event on stdin and the
// result on stdout. A real event shape, a real handler, a real return value.
// For a Node function that is most of what a local test is for.
//
// A separate process rather than `require()` in this one, for three reasons
// that are all the same reason: a handler that calls `process.exit` should not
// take the emulator with it, a handler that leaks globals should not affect the
// next invocation, and a handler that never returns should be killable. In
// process it would be none of those.
//
// ## What it does not do, and will not pretend to
//
// **Only Node runtimes.** Python, Go, Java and the rest need their own runtime
// present, and this container has Node. A Python function is refused by name
// rather than silently failing to import.
//
// **The timeout is enforced; the memory limit is not.** A Node process cannot
// be held to 128MB without flags this does not set, so `MemorySize` is recorded
// and ignored. That is stated because the failure it hides is real: a function
// that works here can be killed by AWS for memory.
//
// **No cold starts, no concurrency limits, no VPC, no layers.** Nothing here
// models them, and nothing pretends to.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { DEFAULT_ACCOUNT } = require("../store.js");

const NAME = "lambda";
const NODE_RUNTIME = /^nodejs\d+\.x$/;

function functions(store, region) {
  return store.scope(region, NAME, "functions");
}

function fail(code, message, status = 400) {
  return {
    status,
    headers: { "content-type": "application/json", "x-amzn-errortype": code },
    body: JSON.stringify({ Type: "User", message, __type: code })
  };
}

function ok(payload, status = 200, extraHeaders = {}) {
  return {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(payload === undefined ? {} : payload)
  };
}

// `/2015-03-31/functions/name/invocations` and friends. Lambda's REST paths
// carry the function name in the middle, which is why this service needs the
// path rather than an action name.
function routeOf(request) {
  const path_ = String(request.path || "/");
  const invoke = path_.match(/^\/2015-03-31\/functions\/([^/]+)\/invocations\/?$/);
  if (invoke) return { kind: "invoke", name: decodeURIComponent(invoke[1]) };
  const named = path_.match(/^\/2015-03-31\/functions\/([^/]+)\/?$/);
  if (named) return { kind: "function", name: decodeURIComponent(named[1]) };
  const configuration = path_.match(/^\/2015-03-31\/functions\/([^/]+)\/configuration\/?$/);
  if (configuration) return { kind: "configuration", name: decodeURIComponent(configuration[1]) };
  const code = path_.match(/^\/2015-03-31\/functions\/([^/]+)\/code\/?$/);
  if (code) return { kind: "code", name: decodeURIComponent(code[1]) };
  if (/^\/2015-03-31\/functions\/?$/.test(path_)) return { kind: "collection", name: null };
  return { kind: "unknown", name: null };
}

function summary(fn) {
  return {
    FunctionName: fn.name,
    FunctionArn: fn.arn,
    Runtime: fn.runtime,
    Handler: fn.handler,
    Role: fn.role,
    Timeout: fn.timeout,
    MemorySize: fn.memorySize,
    CodeSize: fn.codeSize,
    Description: fn.description,
    LastModified: fn.modified,
    Version: "$LATEST",
    State: "Active",
    PackageType: "Zip",
    Environment: { Variables: fn.environment }
  };
}

// Unzip the deployment package. `unzip` rather than a reader written here: the
// zip came from a customer's build and may use anything the format allows, and
// a partial reader that silently drops an entry produces a function missing a
// file with no error to explain it.
function unpack(zipBytes, into) {
  fs.mkdirSync(into, { recursive: true });
  const archive = path.join(into, "package.zip");
  fs.writeFileSync(archive, zipBytes);
  try {
    execFileSync("unzip", ["-qq", "-o", archive, "-d", into], { stdio: "pipe" });
  } catch (error) {
    return { ok: false, detail: `the deployment package could not be unzipped: ${String(error.stderr || error.message).slice(0, 200)}` };
  }
  fs.rmSync(archive, { force: true });
  return { ok: true };
}

// The child that runs one invocation. Written to a file next to the handler so
// its relative requires resolve exactly as they would in Lambda.
const RUNNER = `
const path = require("node:path");
let raw = "";
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", async () => {
  let payload;
  try { payload = JSON.parse(raw || "{}"); } catch { payload = {}; }
  const [file, exported] = process.argv.slice(2);
  try {
    const loaded = require(path.resolve(file));
    const fn = loaded[exported] || (loaded.default && loaded.default[exported]);
    if (typeof fn !== "function") {
      process.stdout.write("\\u0000ERR" + JSON.stringify({
        errorType: "Runtime.HandlerNotFound",
        errorMessage: file + " does not export a function called " + exported,
        exports: Object.keys(loaded || {})
      }));
      return;
    }
    const context = {
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME || "function",
      awsRequestId: process.env._X_AMZN_REQUEST_ID || "local",
      memoryLimitInMB: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || "128",
      getRemainingTimeInMillis: () => 30000,
      callbackWaitsForEmptyEventLoop: true
    };
    const result = await fn(payload, context);
    process.stdout.write("\\u0000OK" + JSON.stringify(result === undefined ? null : result));
  } catch (error) {
    process.stdout.write("\\u0000ERR" + JSON.stringify({
      errorType: (error && error.name) || "Error",
      errorMessage: (error && error.message) || String(error),
      trace: String((error && error.stack) || "").split("\\n").slice(0, 12)
    }));
  }
});
`;

const NUL = String.fromCharCode(0);

function invoke(fn, payload, { log = () => {} } = {}) {
  const [file, exported] = String(fn.handler || "index.handler").split(/\.(?=[^.]+$)/);
  const runnerPath = path.join(fn.directory, "__emulator_runner.cjs");
  fs.writeFileSync(runnerPath, RUNNER);

  const started = Date.now();
  const child = spawnSync(process.execPath, [runnerPath, path.join(fn.directory, file), exported || "handler"], {
    input: JSON.stringify(payload === undefined ? {} : payload),
    cwd: fn.directory,
    timeout: Math.max(1, Number(fn.timeout) || 3) * 1000,
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      ...fn.environment,
      AWS_LAMBDA_FUNCTION_NAME: fn.name,
      AWS_LAMBDA_FUNCTION_MEMORY_SIZE: String(fn.memorySize),
      AWS_REGION: fn.region,
      _X_AMZN_REQUEST_ID: `local-${started}`
    }
  });

  // A timeout kill is its own outcome, not a crash. Lambda reports it
  // distinctly and so does this, because "your function was killed at 3s" and
  // "your function threw" send somebody to different places.
  if (child.error && child.error.code === "ETIMEDOUT") {
    return {
      timedOut: true,
      error: {
        errorType: "Sandbox.Timedout",
        errorMessage: `${fn.name} ran longer than its ${fn.timeout}s timeout and was stopped.`
      }
    };
  }

  const stdout = String(child.stdout || "");
  const marker = stdout.lastIndexOf(NUL);
  // Anything the handler printed before the marker is its logs. Written to this
  // container's stdout, which is where `docker logs` looks -- CloudWatch is not
  // emulated and inventing a log group would be a lie about where to find them.
  const printed = marker === -1 ? stdout : stdout.slice(0, marker);
  if (printed.trim()) log(printed.trimEnd());
  if (String(child.stderr || "").trim()) log(String(child.stderr).trimEnd());

  if (marker === -1) {
    return {
      error: {
        errorType: "Runtime.ExitError",
        errorMessage: `${fn.name} exited without returning anything (code ${child.status}).`,
        trace: String(child.stderr || "").split("\n").slice(0, 12)
      }
    };
  }

  const tail = stdout.slice(marker + 1);
  const kind = tail.slice(0, tail.startsWith("OK") ? 2 : 3);
  const json = tail.slice(kind.length);
  try {
    return kind === "OK" ? { result: JSON.parse(json) } : { error: JSON.parse(json) };
  } catch {
    return { error: { errorType: "Runtime.MalformedResponse", errorMessage: "the handler's result could not be read back" } };
  }
}

function handle(request, { store, log }) {
  const region = request.region;
  const all = functions(store, region);
  const route = routeOf(request);
  const method = String(request.method || "GET").toUpperCase();

  let input = {};
  if (request.body && request.body.length && route.kind !== "invoke") {
    try { input = JSON.parse(request.body.toString("utf8")); } catch { input = {}; }
  }

  if (route.kind === "collection" && method === "POST") {
    const name = String(input.FunctionName || "");
    if (!name) return fail("ValidationException", "FunctionName is required.");
    if (all.has(name)) return fail("ResourceConflictException", `Function already exist: ${name}`, 409);

    const runtime = String(input.Runtime || "");
    if (!NODE_RUNTIME.test(runtime)) {
      // Refused by name. A Python function accepted here would fail at
      // invocation with a require error, which reads as a bug in the handler.
      return fail("InvalidParameterValueException",
        `This emulator runs Node functions only, and this one is "${runtime || "(none)"}". `
        + "It refuses at create time rather than at invoke time, so the reason is clear.", 400);
    }

    const zip = input.Code && input.Code.ZipFile
      ? Buffer.from(String(input.Code.ZipFile), "base64")
      : null;
    if (!zip) {
      return fail("InvalidParameterValueException",
        "This emulator takes the code inline as Code.ZipFile. Code.S3Bucket is not read, because a function pointing at "
        + "a bucket it cannot reach would be created here and fail only when invoked.");
    }

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `aws-emulator-fn-${name}-`));
    const unpacked = unpack(zip, directory);
    if (!unpacked.ok) return fail("InvalidParameterValueException", unpacked.detail);

    const fn = {
      name,
      region,
      arn: `arn:aws:lambda:${region}:${DEFAULT_ACCOUNT}:function:${name}`,
      runtime,
      handler: String(input.Handler || "index.handler"),
      role: String(input.Role || ""),
      // Recorded and enforced.
      timeout: Number(input.Timeout) || 3,
      // Recorded and NOT enforced -- see the note at the top of this file.
      memorySize: Number(input.MemorySize) || 128,
      description: String(input.Description || ""),
      environment: (input.Environment && input.Environment.Variables) || {},
      codeSize: zip.length,
      modified: new Date().toISOString(),
      directory
    };
    all.set(name, fn);
    store.save();
    return ok(summary(fn), 201);
  }

  if (route.kind === "collection" && method === "GET") {
    return ok({ Functions: [...all.values()].map(summary) });
  }

  const fn = route.name ? all.get(route.name) : null;
  if (route.name && !fn) {
    return fail("ResourceNotFoundException", `Function not found: ${route.name}`, 404);
  }

  if (route.kind === "function" && method === "GET") {
    return ok({ Configuration: summary(fn), Code: { RepositoryType: "S3", Location: "emulator" } });
  }

  if (route.kind === "function" && method === "DELETE") {
    fs.rmSync(fn.directory, { recursive: true, force: true });
    all.delete(fn.name);
    store.save();
    return { status: 204, headers: {}, body: "" };
  }

  if (route.kind === "configuration") {
    if (method === "GET") return ok(summary(fn));
    if (method === "PUT") {
      if (input.Timeout) fn.timeout = Number(input.Timeout);
      if (input.MemorySize) fn.memorySize = Number(input.MemorySize);
      if (input.Handler) fn.handler = String(input.Handler);
      if (input.Environment && input.Environment.Variables) fn.environment = input.Environment.Variables;
      fn.modified = new Date().toISOString();
      store.save();
      return ok(summary(fn));
    }
  }

  if (route.kind === "code" && method === "PUT") {
    const zip = input.ZipFile ? Buffer.from(String(input.ZipFile), "base64") : null;
    if (!zip) return fail("InvalidParameterValueException", "This emulator takes the code inline as ZipFile.");
    fs.rmSync(fn.directory, { recursive: true, force: true });
    const unpacked = unpack(zip, fn.directory);
    if (!unpacked.ok) return fail("InvalidParameterValueException", unpacked.detail);
    fn.codeSize = zip.length;
    fn.modified = new Date().toISOString();
    store.save();
    return ok(summary(fn));
  }

  if (route.kind === "invoke" && method === "POST") {
    let payload = {};
    try {
      payload = request.body && request.body.length ? JSON.parse(request.body.toString("utf8")) : {};
    } catch {
      return fail("InvalidRequestContentException", "The invocation payload is not JSON.");
    }

    const invocationType = String(request.headers["x-amz-invocation-type"] || "RequestResponse");
    const outcome = invoke(fn, payload, { log });

    // Event invocations are accepted and answered 202 with no body, as Lambda
    // does. The work still happened synchronously here, which is a difference
    // worth knowing and not one that changes a result.
    if (invocationType === "Event") return { status: 202, headers: {}, body: "" };

    if (outcome.error) {
      // 200 with X-Amz-Function-Error is how Lambda reports a handler that
      // threw -- the *invocation* succeeded. An emulator returning 500 here
      // makes every SDK retry, and the retries look like a flaky function.
      return {
        status: outcome.timedOut ? 200 : 200,
        headers: { "content-type": "application/json", "x-amz-function-error": "Unhandled" },
        body: JSON.stringify(outcome.error)
      };
    }
    return ok(outcome.result === undefined ? null : outcome.result);
  }

  return fail("ResourceNotFoundException",
    `This emulator does not implement ${method} ${request.path} for Lambda. It implements create, get, update, delete and invoke.`,
    404);
}

module.exports = { NAME, handle, routeOf, invoke, unpack, summary, NODE_RUNTIME };
