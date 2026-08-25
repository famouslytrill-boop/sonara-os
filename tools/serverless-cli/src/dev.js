"use strict";

// The application, running on this machine.
//
// `dev` serves the same routes the deployed API would, invoking the same
// handlers with the same event shape. It is not an emulator of Lambda -- it
// does not enforce memory limits, cold starts or the execution environment --
// and the README says so, because a local runner that quietly differs from
// production is worse than no local runner.
//
// What it does promise is the two things people actually rely on:
//
// **The event is the real shape.** API Gateway's HTTP API sends payload format
// 2.0, and a handler written against a hand-rolled `{ path, body }` object
// compiles, runs locally, and fails in production on `event.requestContext`.
// So the event built here is format 2.0, including the fields people reach for.
//
// **The routes are the routes.** They come from the same manifest the deploy
// uses, so a path that answers here answers there. A 404 here is a 404 there.
//
// TypeScript handlers run directly. Node 22 strips types natively, so there is
// no build step, no bundler and no watcher -- which is the entire reason this
// tool can offer a TypeScript path without acquiring a dependency.

const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

// API Gateway HTTP API, payload format 2.0.
function buildEvent({ method, url, headers, body, routeKey }) {
  const parsed = new URL(url, "http://localhost");
  const query = {};
  for (const [name, value] of parsed.searchParams.entries()) {
    // Repeated parameters arrive comma-joined in format 2.0, not as an array.
    query[name] = name in query ? `${query[name]},${value}` : value;
  }

  const now = new Date();
  return {
    version: "2.0",
    routeKey,
    rawPath: parsed.pathname,
    rawQueryString: parsed.search.replace(/^\?/, ""),
    headers: { ...headers },
    ...(Object.keys(query).length ? { queryStringParameters: query } : {}),
    requestContext: {
      accountId: "local",
      apiId: "local",
      domainName: "localhost",
      http: {
        method,
        path: parsed.pathname,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: headers["user-agent"] || ""
      },
      requestId: `local-${now.getTime()}`,
      routeKey,
      stage: "$default",
      time: now.toUTCString(),
      timeEpoch: now.getTime()
    },
    ...(body ? { body, isBase64Encoded: false } : {}),
    isBase64Encoded: false
  };
}

// The context object. Handlers reach for these often enough that leaving them
// undefined turns a local run into a crash that production would not have.
function buildContext(fn) {
  const started = Date.now();
  return {
    functionName: fn.name,
    functionVersion: "$LATEST",
    memoryLimitInMB: String(fn.memory),
    awsRequestId: `local-${started}`,
    logGroupName: `/aws/lambda/${fn.name}`,
    logStreamName: "local",
    invokedFunctionArn: `arn:aws:lambda:local:000000000000:function:${fn.name}`,
    getRemainingTimeInMillis: () => Math.max(0, fn.timeout * 1000 - (Date.now() - started)),
    callbackWaitsForEmptyEventLoop: true
  };
}

// Find the handler file, trying each extension Node can load. Reported as a
// list when nothing matches, because "cannot find module" without saying where
// it looked is the least useful error in this whole tool.
const EXTENSIONS = Object.freeze([".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"]);

function resolveHandlerFile(projectRoot, handlerFile) {
  const base = path.resolve(projectRoot, handlerFile);
  if (!base.startsWith(path.resolve(projectRoot))) {
    throw Object.assign(new Error(`"${handlerFile}" points outside the project.`), { code: "outside_project" });
  }
  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (fs.existsSync(candidate)) return candidate;
  }
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  throw Object.assign(
    new Error(`Could not find the file for "${handlerFile}".`),
    { code: "no_handler_file", looked: EXTENSIONS.map((extension) => `${handlerFile}${extension}`) }
  );
}

/**
 * Load a handler, freshly, on every call.
 *
 * The require cache is cleared for the handler's own file so an edit takes
 * effect on the next request without restarting. Only that file: clearing the
 * whole cache would reload this tool's own modules mid-request.
 */
async function loadHandler(projectRoot, fn) {
  const file = resolveHandlerFile(projectRoot, fn.handlerFile);
  delete require.cache[require.resolve(file)];

  let module_;
  try {
    module_ = require(file);
  } catch (error) {
    throw Object.assign(
      new Error(`${fn.handlerFile} could not be loaded: ${error.message}`),
      { code: "handler_threw_on_load", cause: error }
    );
  }

  const exported = module_?.[fn.handlerExport] ?? module_?.default?.[fn.handlerExport];
  if (typeof exported !== "function") {
    const available = Object.keys(module_ || {}).filter((key) => typeof module_[key] === "function");
    throw Object.assign(
      new Error(`${fn.handlerFile} does not export a function called "${fn.handlerExport}".`),
      { code: "no_such_export", available }
    );
  }
  return exported;
}

// What a handler returned, turned into an HTTP response.
//
// API Gateway accepts three shapes and this accepts the same three, because a
// handler that works locally and 502s in production is the exact failure this
// is supposed to prevent.
function toResponse(returned) {
  if (returned === undefined || returned === null) {
    return { status: 200, headers: { "content-type": "application/json" }, body: "" };
  }
  if (typeof returned === "string") {
    return { status: 200, headers: { "content-type": "text/plain; charset=utf-8" }, body: returned };
  }
  if (typeof returned === "object" && !Array.isArray(returned) && "statusCode" in returned) {
    const headers = { ...(returned.headers || {}) };
    let body = returned.body ?? "";
    if (typeof body !== "string") body = JSON.stringify(body);
    if (!Object.keys(headers).some((name) => name.toLowerCase() === "content-type")) {
      headers["content-type"] = "application/json";
    }
    return {
      status: Number(returned.statusCode) || 200,
      headers,
      body: returned.isBase64Encoded ? Buffer.from(body, "base64") : body
    };
  }
  // Anything else is JSON with a 200, which is what API Gateway does.
  return { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(returned) };
}

// Route matching, including {id} path parameters, which HTTP APIs support and
// people use immediately.
function matchRoute(routes, method, pathname) {
  for (const route of routes) {
    if (route.method !== method && route.method !== "ANY") continue;
    const routeParts = route.path.split("/").filter(Boolean);
    const pathParts = pathname.split("/").filter(Boolean);

    if (route.path.endsWith("/{proxy+}")) {
      const prefix = routeParts.slice(0, -1);
      if (pathParts.length >= prefix.length && prefix.every((part, i) => part === pathParts[i])) {
        return { route, parameters: { proxy: pathParts.slice(prefix.length).join("/") } };
      }
      continue;
    }
    if (routeParts.length !== pathParts.length) continue;

    const parameters = {};
    let matched = true;
    for (let i = 0; i < routeParts.length; i += 1) {
      const expected = routeParts[i];
      if (expected.startsWith("{") && expected.endsWith("}")) {
        parameters[expected.slice(1, -1)] = decodeURIComponent(pathParts[i]);
        continue;
      }
      if (expected !== pathParts[i]) { matched = false; break; }
    }
    if (matched) return { route, parameters };
  }
  return null;
}

function routesFor(app) {
  const routes = [];
  for (const fn of app.functions) {
    for (const event of fn.events) {
      if (event.kind !== "http") continue;
      routes.push({ method: event.method, path: event.path, fn });
    }
  }
  return routes;
}

/**
 * Run the application locally.
 *
 * Returns { port, url, close() }. The server is created rather than started on
 * a fixed port so a test can run several without collisions.
 */
async function serve(app, { projectRoot, port = 3000, log = () => {} } = {}) {
  const routes = routesFor(app);

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, "http://localhost");

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks).toString("utf8") : null;

    const matched = matchRoute(routes, req.method, url.pathname);
    if (!matched) {
      res.writeHead(404, { "content-type": "application/json" });
      log(`  ${req.method} ${url.pathname} -> 404 (no route)`);
      // The same body API Gateway sends, plus the routes there are -- because
      // locally, unlike in production, we can actually help.
      return res.end(JSON.stringify({
        message: "Not Found",
        routes: routes.map((route) => `${route.method} ${route.path}`)
      }, null, 2));
    }

    const { route, parameters } = matched;
    const event = buildEvent({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body,
      routeKey: `${route.method} ${route.path}`
    });
    if (Object.keys(parameters).length) event.pathParameters = parameters;

    // The function's environment, applied for the length of the call and then
    // put back. Handlers read process.env at module load as often as inside the
    // function, and leaving the variables set would leak one function's
    // configuration into the next one invoked.
    const previous = {};
    for (const [name, value] of Object.entries(route.fn.environment)) {
      previous[name] = process.env[name];
      process.env[name] = value;
    }

    try {
      const handler = await loadHandler(projectRoot, route.fn);
      const returned = await Promise.race([
        Promise.resolve(handler(event, buildContext(route.fn))),
        new Promise((_, reject) => {
          const timer = setTimeout(
            () => reject(Object.assign(new Error(`${route.fn.name} ran longer than its ${route.fn.timeout}s timeout.`), { code: "timeout" })),
            route.fn.timeout * 1000
          );
          timer.unref?.();
        })
      ]);
      const response = toResponse(returned);
      res.writeHead(response.status, response.headers);
      res.end(response.body);
      log(`  ${req.method} ${url.pathname} -> ${response.status} (${route.fn.name}, ${Date.now() - started}ms)`);
    } catch (error) {
      // The stack goes to the terminal and a plain message goes to the client.
      // 502 rather than 500: that is what API Gateway returns when a function
      // throws, so the local behaviour matches.
      log(`  ${req.method} ${url.pathname} -> 502 (${route.fn.name} threw)`);
      log(String(error.stack || error.message));
      if (error.looked) log(`  looked for: ${error.looked.join(", ")}`);
      if (error.available?.length) log(`  it exports: ${error.available.join(", ")}`);
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Internal Server Error", detail: error.message }, null, 2));
    } finally {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  await new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const actualPort = server.address().port;
  return {
    port: actualPort,
    url: `http://127.0.0.1:${actualPort}`,
    routes,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

module.exports = { serve, buildEvent, buildContext, toResponse, matchRoute, routesFor, loadHandler, resolveHandlerFile };
