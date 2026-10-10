"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Exercise the shipped worker's decisions, not a reconstructed regex.
// This does not register a real browser service worker.
const source = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");
const origin = "https://sonaraindustries.com";
const handlers = {};
const scope = {
  location: { origin },
  addEventListener: (type, handler) => { handlers[type] = handler; }
};
vm.runInNewContext(
  source + "\nself.__contract = { isPublicStaticRequest, isPublicNavigation, isCacheableResponse, VERSION, PUBLIC_STAGE, CACHE_NAME };",
  { self: scope, URL }
);
const { isPublicStaticRequest, isPublicNavigation, isCacheableResponse, VERSION, PUBLIC_STAGE, CACHE_NAME } = scope.__contract;
const allowed = (url) => isPublicStaticRequest(new URL(url, origin));

function simulateWorkerInstall(overrides = {}) {
  const requests = [];
  const writes = [];
  const deletions = [];
  const events = {};
  let takeovers = 0;
  const worker = {
    location: { origin },
    addEventListener: (type, handler) => { events[type] = handler; },
    skipWaiting: () => { takeovers += 1; }
  };
  class AnonymousRequest {
    constructor(url, options) {
      this.url = url;
      this.credentials = options.credentials;
      this.cache = options.cache;
      this.redirect = options.redirect;
      requests.push(this);
    }
  }
  const cache = { put: async (url) => { writes.push(url); } };
  const storage = {
    open: async () => cache,
    delete: async (key) => { deletions.push(key); return true; }
  };
  const network = async (request) => {
    const url = new URL(request.url);
    const failure = overrides.failAt && url.pathname === overrides.failAt;
    const privateReply = overrides.privateAt && url.pathname === overrides.privateAt;
    const htmlReply = overrides.htmlAt && url.pathname === overrides.htmlAt;
    const wrongMime = overrides.mimeAt && url.pathname === overrides.mimeAt;
    const noPublicPolicy = overrides.noPublicAt && url.pathname === overrides.noPublicAt;
    const extension = url.pathname.split(".").pop();
    const expectedMime = url.pathname === "/offline" ? "text/html"
      : extension === "css" ? "text/css"
      : extension === "svg" ? "image/svg+xml"
      : extension === "png" ? "image/png"
      : extension === "ico" ? "image/x-icon"
      : extension === "webmanifest" ? "application/manifest+json"
      : extension === "woff2" ? "font/woff2"
      : "application/javascript";
    return {
      status: failure ? 503 : 200,
      ok: !failure,
      type: "basic",
      redirected: false,
      url: request.url,
      headers: {
        get: (name) => name.toLowerCase() === "cache-control" && privateReply ? "private"
          : name.toLowerCase() === "cache-control" && noPublicPolicy ? ""
          : name.toLowerCase() === "content-type" && htmlReply ? "text/html"
          : name.toLowerCase() === "content-type" && wrongMime ? "application/json"
          : name.toLowerCase() === "cache-control" ? "public, max-age=60"
          : name.toLowerCase() === "content-type" ? expectedMime
          : null,
        has: () => false
      }
    };
  };
  vm.runInNewContext(source, { self: worker, URL, Request: AnonymousRequest, fetch: network, caches: storage });
  let installation;
  events.install({ waitUntil: (promise) => { installation = promise; } });
  return {
    installation, requests, writes, deletions, takeoverCount: () => takeovers
  };
}

function simulateRuntimeFetch({ cacheHit = true, cacheControl = "public, max-age=60", vary = "", contentType = "application/javascript", networkFails = false } = {}) {
  const requests = [];
  const writes = [];
  const events = {};
  const existing = { source: "cached" };
  const response = {
    source: "network", status: 200, ok: true, type: "basic", redirected: false,
    url: origin + "/sonara-one.js?v=" + VERSION,
    headers: {
      get: (name) => name === "cache-control" ? cacheControl :
        name === "vary" ? vary :
        name === "content-type" ? contentType : null,
      has: () => false
    },
    clone() { return { ...this, source: "network-clone" }; }
  };
  const worker = {
    location: { origin },
    addEventListener: (eventName, handler) => { events[eventName] = handler; }
  };
  class AnonymousRequest {
    constructor(url, options) { this.url = typeof url === "string" ? url : url.url; Object.assign(this, options); requests.push(this); }
  }
  const storage = {
    open: async () => ({
      match: async () => cacheHit ? existing : undefined,
      put: async (request, value) => { writes.push({ request, value }); }
    })
  };
  vm.runInNewContext(source, {
    self: worker, URL, Request: AnonymousRequest, caches: storage,
    fetch: async () => {
      if (networkFails) throw new Error("network offline");
      return response;
    }
  });
  let handled;
  let lifetime;
  events.fetch({
    request: { method: "GET", mode: "no-cors", url: response.url },
    respondWith: (promise) => { handled = promise; },
    waitUntil: (promise) => { lifetime = promise; }
  });
  return { handled, lifetime: () => lifetime, requests, writes, existing, response };
}

describe("cross-device service-worker cache boundary", () => {
  it("accepts the public release assets that it actually precaches", () => {
    for (const asset of PUBLIC_STAGE) {
      if (asset === "/offline") continue;
      assert.equal(allowed(asset), true, asset);
    }
    assert.equal(allowed("/icons/icon-192.png"), true);
    for (const known of ["/sonara-prepaint.js", "/sonara-experience-controls.js", "/sonara-product-entry.css"]) {
      assert.equal(allowed(known), true, known);
    }
  });

  it("rejects arbitrary tenant, API and nested user-file paths even when they look static", () => {
    for (const name of [
      "/api/account/profile.png",
      "/api/creator/generated-asset.js",
      "/account/statement.png",
      "/customer/invoices/invoice.svg",
      "/storage/workspaces/asset.png",
      "/media/private/camera-image.png",
      "/uploads/tenant/file.js",
      "/creator-studio/projects/private.js",
      "/release/private/asset.png",
      "/customer-export.js",
      "/account-session.css",
      "/tenant-receipt.svg",
      "/arbitrary-plugin.js"
    ]) {
      assert.equal(allowed(name), false, name);
    }
  });

  it("refuses to persist arbitrary cache keys or old-version asset queries", () => {
    for (const suffix of [
      "?token=secret",
      "?v=old",
      "?v=" + VERSION + "&token=secret",
      "?v=" + VERSION + "&v=" + VERSION,
      "?credentials=include"
    ]) assert.equal(allowed("/sonara-one.js" + suffix), false, suffix);
    assert.equal(allowed("/sonara-one.js?v=" + VERSION), true);
    assert.equal(allowed("/sonara-one.js"), true);
  });

  it("does not intercept unauthorized navigations or seemingly-static API responses", () => {
    assert.equal(isPublicNavigation("/login"), false);
    assert.equal(isPublicNavigation("/signup"), false);
    assert.equal(isPublicNavigation("/dashboard"), false);
    assert.equal(isPublicNavigation("/api/account"), false);
    assert.equal(isPublicNavigation("/creator-studio/projects/private"), false);
    assert.equal(isPublicNavigation("/pricing"), true);
    assert.equal(isPublicNavigation("/legal/privacy"), true);
    for (const url of [
      "/api/account/photo.png",
      "/customer/download.js",
      "/sonara-one.js?token=secret"
    ]) {
      let intercepted = false;
      handlers.fetch({
        request: { method: "GET", mode: "no-cors", url: origin + url },
        respondWith: () => { intercepted = true; }
      });
      assert.equal(intercepted, false, url + " must reach the network unhandled");
    }
  });

  it("fails installation instead of precaching a misconfigured private resource", async () => {
    const badEntry = '  "/api/account/private-export.png",';
    const originalEntry = '  "/site.webmanifest",';
    assert.ok(source.includes(originalEntry));
    const unsafe = source.replace(originalEntry, badEntry + "\n" + originalEntry);
    const handlersUnsafe = {};
    const unsafeScope = {
      location: { origin },
      addEventListener: (type, handler) => { handlersUnsafe[type] = handler; },
      skipWaiting: () => undefined
    };
    vm.runInNewContext(unsafe, {
      self: unsafeScope,
      URL,
      caches: { open: async () => ({ add: async () => undefined }) }
    });
    let installation;
    handlersUnsafe.install({ waitUntil: (task) => { installation = task; } });
    await assert.rejects(installation, /Unsafe asset configured for offline precache/);
  });

  it("installs the offline shell without cookies or forced activation", async () => {
    const job = simulateWorkerInstall();
    await job.installation;
    assert.ok(job.writes.length >= 4, "core public shell and offline fallback must be cached");
    assert.equal(job.deletions.length, 0);
    assert.equal(job.takeoverCount(), 0, "existing tabs must keep their current worker");
    for (const request of job.requests) {
      assert.equal(request.credentials, "omit");
      assert.equal(request.cache, "no-store");
      assert.equal(request.redirect, "error");
    }
  });

  it("rejects a private core response and clears incomplete installation", async () => {
    const job = simulateWorkerInstall({ privateAt: "/sonara-design-system.css" });
    await assert.rejects(job.installation, /anonymous public response/);
    assert.equal(job.deletions.length, 1);
    assert.equal(job.takeoverCount(), 0);
  });

  it("rejects HTML supplied instead of executable JavaScript", async () => {
    const job = simulateWorkerInstall({ htmlAt: "/sonara-one.js" });
    await assert.rejects(job.installation, /unexpected content type/);
    assert.equal(job.deletions.length, 1);
  });

  it("revalidates public JS anonymously and holds worker lifetime for cache writes", async () => {
    const task = simulateRuntimeFetch();
    assert.equal(await task.handled, task.existing);
    await task.lifetime();
    assert.equal(task.requests.length, 1);
    assert.equal(task.requests[0].credentials, "omit");
    assert.equal(task.requests[0].cache, "no-cache");
    assert.equal(task.requests[0].redirect, "error");
    assert.equal(task.writes.length, 1);
    assert.equal(task.writes[0].value.source, "network-clone");
  });

  it("does not save private or HTML responses as offline JavaScript", async () => {
    for (const options of [
      { cacheControl: "private" }, { cacheControl: "" }, { cacheControl: "max-age=60" },
      { cacheControl: "public, no-cache" }, { cacheControl: "public, must-revalidate" },
      { vary: "Accept-Encoding, Cookie" }, { vary: "Authorization" },
      { contentType: "text/html" }, { contentType: "application/json" }
    ]) {
      const task = simulateRuntimeFetch(options);
      assert.equal(await task.handled, task.existing);
      await task.lifetime();
      assert.equal(task.writes.length, 0, JSON.stringify(options));
    }
  });

  it("propagates network failure when there is no cached asset", async () => {
    const task = simulateRuntimeFetch({ cacheHit: false, networkFails: true });
    await assert.rejects(task.handled, /network offline/);
    assert.equal(task.writes.length, 0);
  });

  it("reads offline fallback only from this worker's versioned public cache", async () => {
    const events = {};
    const opened = [];
    let globalCacheMatchCalled = false;
    const offline = { kind: "current-version-offline" };
    const worker = {
      location: { origin },
      addEventListener: (name, handler) => { events[name] = handler; }
    };
    const storage = {
      open: async (key) => {
        opened.push(key);
        return {
          match: async (keyToMatch) => keyToMatch === "/offline" ? offline : undefined
        };
      },
      match: async () => {
        globalCacheMatchCalled = true;
        return { kind: "unrelated-cache" };
      }
    };
    vm.runInNewContext(source, {
      self: worker, URL, caches: storage,
      fetch: async () => { throw new Error("offline"); }
    });
    let response;
    events.fetch({
      request: { method: "GET", mode: "navigate", url: origin + "/pricing" },
      respondWith: (task) => { response = task; }
    });
    assert.equal(await response, offline);
    assert.deepEqual(opened, [CACHE_NAME]);
    assert.equal(globalCacheMatchCalled, false);
  });

  it("cleans retired SONARA caches without taking over existing pages", async () => {
    const events = {};
    const deleted = [];
    let claimed = 0;
    const worker = {
      location: { origin },
      addEventListener: (name, handler) => { events[name] = handler; },
      clients: { claim: async () => { claimed += 1; } }
    };
    const storage = {
      keys: async () => [
        "other-app-cache",
        "sonara-public-previous-release",
        CACHE_NAME
      ],
      delete: async (key) => { deleted.push(key); return true; }
    };
    vm.runInNewContext(source, { self: worker, URL, caches: storage });
    let completion;
    events.activate({ waitUntil: (task) => { completion = task; } });
    await completion;
    assert.deepEqual(deleted, ["sonara-public-previous-release"]);
    assert.equal(claimed, 0);
  });

  it("requires an explicit update request before activating a waiting worker", () => {
    assert.equal(typeof handlers.message, "function");
    assert.match(source, /event\.data\.type === "SKIP_WAITING"/);
    assert.doesNotMatch(source.slice(source.indexOf('self.addEventListener("install"'), source.indexOf('self.addEventListener("activate"')), /self\.skipWaiting\(/);
  });

  it("rejects JSON pretending to be a core stylesheet", async () => {
    const job = simulateWorkerInstall({ mimeAt: "/sonara-design-system.css" });
    await assert.rejects(job.installation, /unexpected content type/);
    assert.equal(job.deletions.length, 1);
  });

  it("requires explicit public caching for the anonymous offline HTML", async () => {
    const job = simulateWorkerInstall({ noPublicAt: "/offline" });
    await assert.rejects(job.installation, /Public offline fallback unavailable/);
    assert.equal(job.deletions.length, 1);
  });

  it("rejects non-public stylesheet responses and cleans failed install", async () => {
    const job = simulateWorkerInstall({ noPublicAt: "/sonara-design-system.css" });
    await assert.rejects(job.installation, /anonymous public response/);
    assert.equal(job.deletions.length, 1);
  });

  it("never intercepts unknown root-level code or user file endpoints", () => {
    for (const endpoint of ["/user-records.js", "/tenant-theme.css", "/statement.svg"]) {
      let intercepted = false;
      handlers.fetch({
        request: { method: "GET", mode: "no-cors", url: origin + endpoint },
        respondWith: () => { intercepted = true; }
      });
      assert.equal(intercepted, false, endpoint);
    }
  });

  it("rejects responses marked private, no-store or set-cookie", () => {
    function response(headers) {
      const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
      return { status: 200, ok: true, type: "basic", headers: {
        get: (key) => lower[key.toLowerCase()] || null,
        has: (key) => Object.hasOwn(lower, key.toLowerCase())
      } };
    }
    assert.equal(isCacheableResponse(response({ "Cache-Control": "public, max-age=60" })), true);
    assert.equal(isCacheableResponse(response({ "Cache-Control": "PUBLIC, max-age=60" })), true);
    assert.equal(isCacheableResponse(response({ "Cache-Control": "max-age=60" })), false);
    assert.equal(isCacheableResponse(response({})), false);
    assert.equal(isCacheableResponse(response({ "Cache-Control": "not-public, max-age=60" })), false);
    assert.equal(isCacheableResponse(response({ "Cache-Control": "public, no-cache" })), false);
    assert.equal(isCacheableResponse(response({ "Cache-Control": "public, must-revalidate" })), false);
    assert.equal(isCacheableResponse(response({ "Cache-Control": "public", Vary: "Accept-Encoding, Cookie" })), false);
    assert.equal(isCacheableResponse(response({ "Cache-Control": "public", Vary: "Authorization" })), false);
    assert.equal(isCacheableResponse(response({ "Cache-Control": "private" })), false);
    assert.equal(isCacheableResponse(response({ "Cache-Control": "no-store" })), false);
    assert.equal(isCacheableResponse(response({ "Set-Cookie": "session=1" })), false);
  });
});
