"use strict";

// What Express 4 does with an async handler that throws, and why it matters
// here more than the bug count suggests.
//
// `app.get("/x", async (req, res) => { ... })` returns a promise. Express 4
// ignores it. If the handler throws -- or awaits something that rejects --
// nothing calls `next(error)`, nothing writes a response, and the request stays
// open until whoever is at the other end gives up. There are 225 async handlers
// in this application, so this is not a property of one route.
//
// It was found from the other end. docs/SHIP_READINESS.md carried an open
// finding about /admin/database stalling on a healthy catalog, undiagnosed since
// 13 August. The stall is the shape above: a rejection swallowed by the
// framework. Probed directly, a throwing async handler on this app produces
// "UNHANDLED REJECTION" on the process and no response at all, through a
// five-second deadline.
//
// A stall is a worse failure than a 500 in three separate ways, which is why
// this is worth a module rather than a try/catch in the handler that was
// noticed. A customer sees a spinner instead of an error, so they retry rather
// than report. On Vercel the function is billed until its own timeout rather
// than until the error. And the page it happened on here is the one an owner
// opens when they already suspect something is broken -- the page whose whole
// job is to tell them what is wrong.
//
// So the fix is at registration rather than at each call site: 225 handlers
// cannot be individually remembered, and the 226th would be written by somebody
// who never read this file.

// Express decides a middleware is an error handler by its parameter count, so
// the wrappers below must keep the arity of what they wrap. A 4-argument
// handler wrapped in a 3-argument function silently stops being an error
// handler and starts being ordinary middleware that receives the error object
// as `req`.
const WRAPPED = Symbol.for("sonara.asyncRouteSafety.wrapped");

function settle(result, next) {
  if (result && typeof result.then === "function") result.then(undefined, next);
  return result;
}

function wrapHandler(handler) {
  if (typeof handler !== "function") return handler;
  if (handler[WRAPPED]) return handler;
  // An Express router is also a function, and it carries its own stack. Wrapping
  // one would still work at runtime but would hide `.stack` from
  // scripts/verify-route-registry.cjs, which walks it to count registrations.
  if (typeof handler.stack !== "undefined" || typeof handler.handle === "function") return handler;

  const wrapped = handler.length >= 4
    ? function (error, req, res, next) {
      try {
        return settle(handler.call(this, error, req, res, next), next);
      } catch (thrown) {
        return next(thrown);
      }
    }
    : function (req, res, next) {
      try {
        return settle(handler.call(this, req, res, next), next);
      } catch (thrown) {
        return next(thrown);
      }
    };

  // Kept so stack traces and any introspection still name the handler rather
  // than reporting 226 functions all called `wrapped`.
  Object.defineProperty(wrapped, "name", { value: handler.name || "handler", configurable: true });
  wrapped[WRAPPED] = true;
  return wrapped;
}

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "all", "use"];

// Must run before any route is registered. Anything registered earlier keeps
// the old behaviour, which is exactly the failure this exists to remove, so
// `installedBeforeRoutes` is asserted rather than assumed.
function installAsyncRouteSafety(app) {
  if (app[WRAPPED]) return app;
  if (app._router && app._router.stack && app._router.stack.some((layer) => layer.route)) {
    throw new Error("installAsyncRouteSafety must run before any route is registered; routes are already on the stack.");
  }

  for (const method of METHODS) {
    const original = app[method];
    if (typeof original !== "function") continue;
    app[method] = function (...args) {
      // `app.get("view engine")` is the settings reader, not a route. It is the
      // one overload here where the arguments are not handlers.
      if (method === "get" && args.length === 1) return original.apply(this, args);
      return original.apply(this, args.map((arg) => (typeof arg === "function" ? wrapHandler(arg) : arg)));
    };
  }

  app[WRAPPED] = true;
  return app;
}

// The other half. Wrapping turns a stall into `next(error)`; without a terminal
// handler that lands on Express's default, which answers with a stack trace
// outside production and a bare "Internal Server Error" inside it. Neither is
// something to show a customer, and the first is something to show nobody.
//
// Register this last, after every route and after the 413 handler.
function createAsyncErrorHandler(deps = {}) {
  const renderHtml = typeof deps.renderHtml === "function" ? deps.renderHtml : null;
  const log = typeof deps.log === "function" ? deps.log : (message) => console.error(message);

  return function sonaraAsyncErrorHandler(error, req, res, next) {
    // Once bytes are on the wire there is no status left to set, and writing a
    // second body corrupts the first. Express's default closes the connection,
    // which is the only honest ending available.
    if (res.headersSent) return next(error);

    // Server-side only, and deliberately without the request body: this fires
    // on payment and admin routes among others, and an error log is not a place
    // to start keeping copies of what customers submitted.
    log(`[route-error] ${req.method} ${req.originalUrl || req.url} -> ${error && error.stack ? error.stack : error}`);

    const wantsJson = String(req.path || "").startsWith("/api/")
      || String(req.get?.("accept") || "").includes("application/json");

    if (wantsJson) {
      return res.status(500).json({
        ok: false,
        code: "request_failed",
        message: "Something went wrong handling this request. Nothing was changed by the part that failed."
      });
    }

    // No error text, no stack, no route internals. A customer can act on "try
    // again or tell us"; they cannot act on a TypeError, and it names files.
    const body = renderHtml
      ? renderHtml({ path: req.originalUrl || req.url })
      : "<!doctype html><html><head><title>Something went wrong</title></head><body><h1>Something went wrong</h1><p>This page could not be built just now. Try again, and tell us if it keeps happening.</p></body></html>";

    return res.status(500).type("html").send(body);
  };
}

module.exports = { installAsyncRouteSafety, createAsyncErrorHandler, wrapHandler };
