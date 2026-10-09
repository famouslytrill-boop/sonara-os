// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const workerSource = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");

function harness({ status = 200, headers = {}, type = "basic", redirected = false, existingCaches = [], overrides = {} } = {}) {
  const handlers = new Map();
  const stored = [];
  const removed = [];
  const evicted = [];
  const active = new Map();
  const network = [];
  let networkRequests = 0;
  function makeResponse(target) {
    const pathname = new URL(typeof target === "string" ? target : target.url, "https://sonaraindustries.com").pathname;
    const mimeTypes = {
      css: "text/css", js: "text/javascript", svg: "image/svg+xml",
      png: "image/png", ico: "image/x-icon", webmanifest: "application/manifest+json",
      woff2: "font/woff2"
    };
    const extension = pathname.split(".").pop();
    const specific = overrides[pathname] || {};
    const code = specific.status ?? status;
    return {
      ok: code >= 200 && code < 300,
      status: code,
      type: specific.type || type,
      redirected: specific.redirected ?? redirected,
      headers: new Headers({
        "content-type": pathname === "/offline" ? "text/html; charset=utf-8" : (mimeTypes[extension] || "text/html"),
        "cache-control": pathname === "/offline" ? "public, max-age=0" : "public, max-age=300",
        ...headers, ...(specific.headers || {})
      }),
      clone() { return this; }
    };
  }
  const cache = {
    match: async (request) => active.get(typeof request === "string" ?
      new URL(request, "https://sonaraindustries.com").href : request.url),
    put: async (request, response) => {
      const url = typeof request === "string" ? new URL(request, "https://sonaraindustries.com").href : request.url;
      stored.push({
        url,
        credentials: typeof request === "string" ? "omit" : request.credentials
      });
      active.set(url, response);
    },
    delete: async (request) => {
      const url = typeof request === "string" ? new URL(request, "https://sonaraindustries.com").href : request.url;
      evicted.push(url);
      return active.delete(url);
    },
    add: async () => undefined
  };
  class SyntheticRequest {
    constructor(input, options = {}) {
      this.url = input.url;
      this.method = input.method;
      this.mode = input.mode;
      this.cache = input.cache;
      this.headers = input.headers;
      this.credentials = options.credentials || input.credentials;
    }
  }
  const context = {
    self: {
      location: { origin: "https://sonaraindustries.com" },
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: () => undefined,
      clients: { claim: async () => undefined }
    },
    caches: {
      open: async () => cache,
      match: async () => undefined,
      keys: async () => existingCaches,
      delete: async (name) => {
        removed.push(name);
        if (name.startsWith("sonara-public-")) active.clear();
        return true;
      }
    },
    fetch: async (target, options = {}) => {
      networkRequests += 1;
      network.push({
        url: typeof target === "string" ? target : target.url,
        credentials: options.credentials || (typeof target === "string" ? "same-origin" : target.credentials)
      });
      return makeResponse(target);
    },
    URL,
    Request: SyntheticRequest,
    Set,
    Promise
  };
  vm.runInNewContext(workerSource, context, { filename: "public/sw.js" });

  async function request(target, { mode = "cors", cacheMode = "default", requestHeaders = {}, credentials = "same-origin" } = {}) {
    let handled;
    const waits = [];
    const event = {
      request: {
        url: new URL(target, context.self.location.origin).href,
        method: "GET",
        mode,
        cache: cacheMode,
        credentials,
        headers: new Headers(requestHeaders)
      },
      respondWith: (promise) => { handled = promise; },
      waitUntil: (promise) => { waits.push(promise); }
    };
    handlers.get("fetch")(event);
    if (handled) await handled;
    await Promise.all(waits);
    return Boolean(handled);
  }
  async function activate() {
    let completion;
    handlers.get("activate")({ waitUntil: (promise) => { completion = promise; } });
    await completion;
  }
  async function install() {
    let completion;
    handlers.get("install")({ waitUntil: (promise) => { completion = promise; } });
    await completion;
  }
  return { request, activate, install, stored, removed, evicted, active, network, networkRequests: () => networkRequests };
}

describe("PWA cache contains public assets only", () => {
  it("evicts the previous extension-matched public cache during activation", async () => {
    const staleName = "sonara-public-sonara-ui-20261007-v23-native-navigation";
    const worker = harness({ existingCaches: [staleName, "unrelated-cache"] });
    await worker.activate();
    assert.deepEqual(worker.removed, [staleName]);
  });

  it("retains same-origin public assets and their single revision token", async () => {
    const worker = harness();
    for (const asset of [
      "/sonara-one.js?v=sonara-ui-20261007-v23-native-navigation",
      "/sonara-application-ui.css",
      "/site.webmanifest",
      "/brand/sonara-one-mark-v3.svg",
      "/fonts/geist-latin.woff2"
    ]) {
      assert.equal(await worker.request(asset), true, asset);
    }
    assert.equal(worker.stored.length, 5);
    assert.ok(worker.stored.every((entry) => entry.credentials === "omit"));
    assert.ok(worker.network.every((entry) => entry.credentials === "omit"));
  });

  it("does not intercept tenant content, deep routes or private APIs with static extensions", async () => {
    const worker = harness();
    for (const path of [
      "/api/tenant/report.png",
      "/business-builder/owner/chart.svg",
      "/creator-studio/projects/secret.js",
      "/growth-studio/campaigns/private.css",
      "/api/assets/invoice.png",
      "/.well-known/assetlinks.json",
      "/sw.js"
    ]) {
      assert.equal(await worker.request(path), false, path);
    }
    assert.equal(worker.networkRequests(), 0);
    assert.equal(worker.stored.length, 0);
  });

  it("refuses token-bearing queries and requests explicitly marked private", async () => {
    const worker = harness();
    for (const path of [
      "/sonara-one.js?token=secret",
      "/sonara-one.js?v=ok&signature=secret",
      "/sonara-one.js?v=",
      "/sonara-one.js?v=ok&v=again",
      "/brand/mark.svg?expires=123",
      "/sonara-one.js?v=hello%20world"
    ]) {
      assert.equal(await worker.request(path), false, path);
    }
    assert.equal(await worker.request("/sonara-one.js", { requestHeaders: { Authorization: "Bearer private" } }), false);
    assert.equal(await worker.request("/sonara-one.js", { cacheMode: "no-store" }), false);
    assert.equal(await worker.request("/sonara-one.js", { cacheMode: "no-cache" }), false);
    assert.equal(await worker.request("/sonara-one.js", { cacheMode: "reload" }), false);
    assert.equal(worker.stored.length, 0);
    assert.equal(worker.networkRequests(), 0);
  });

  it("strips signed-in caller credentials before network fetch and public cache storage", async () => {
    const worker = harness();
    assert.equal(await worker.request("/sonara-one.js", { credentials: "include" }), true);
    assert.deepEqual(worker.network.map((entry) => entry.credentials), ["omit"]);
    assert.deepEqual(worker.stored.map((entry) => entry.credentials), ["omit"]);
    assert.equal(await worker.request("/sonara-application-ui.css"), true);
    assert.ok(worker.network.every((entry) => entry.credentials === "omit"));
    assert.ok(worker.stored.every((entry) => entry.credentials === "omit"));
  });

  it("does not persist responses personalized by cookies, auth, or privacy directives", async () => {
    for (const scenario of [
      { headers: { "cache-control": "private, max-age=3600" } },
      { headers: { "cache-control": "no-store" } },
      { headers: { "cache-control": "no-cache" } },
      { headers: { "cache-control": "max-age=0" } },
      { headers: { "cache-control": "private, public" } },
      { headers: { "set-cookie": "session=sensitive" } },
      { headers: { vary: "Accept-Encoding, Cookie" } },
      { headers: { vary: "Authorization" } },
      { headers: { vary: "*" } },
      { status: 206 },
      { status: 404 },
      { type: "opaque" },
      { redirected: true },
      { headers: { "content-type": "text/html; charset=utf-8" } },
      { headers: { "content-type": "application/json" } }
    ]) {
      const worker = harness(scenario);
      assert.equal(await worker.request("/sonara-one.js"), true);
      assert.equal(worker.networkRequests(), 1, JSON.stringify(scenario));
      assert.equal(worker.stored.length, 0, JSON.stringify(scenario));
    }
  });

  it("requires the static origin to opt in explicitly with Cache-Control public", async () => {
    const worker = harness({ headers: { "cache-control": "max-age=3600" } });
    assert.equal(await worker.request("/sonara-one.js"), true);
    assert.equal(worker.stored.length, 0);
  });

  it("precache never stores a login-page response as JavaScript", async () => {
    const worker = harness({ overrides: {
      "/sonara-one.js": { headers: { "content-type": "text/html" } },
      "/sonara-depth.js": { headers: { "set-cookie": "session=not-public" } }
    } });
    await worker.install();
    assert.ok(worker.stored.some((item) => item.url.endsWith("/offline")));
    assert.equal(worker.stored.some((item) => item.url.includes("/sonara-one.js")), false);
    assert.equal(worker.stored.some((item) => item.url.includes("/sonara-depth.js")), false);
    assert.ok(worker.stored.some((item) => item.url.includes("/sonara-application-ui.css")));
    assert.ok(worker.network.every((item) => item.credentials === "omit"));
  });

  it("rejects unsafe offline fallbacks rather than installing personalized pages", async () => {
    for (const response of [
      { headers: { "set-cookie": "private=1" } },
      { headers: { vary: "Cookie" } },
      { headers: { vary: "Authorization" } },
      { headers: { "cache-control": "no-store" } },
      { headers: { "cache-control": "private" } },
      { headers: { "cache-control": "no-cache" } },
      { headers: { "cache-control": "max-age=0" } },
      { headers: { "content-type": "application/json" } },
      { redirected: true }
    ]) {
      const worker = harness({ overrides: { "/offline": response } });
      await assert.rejects(() => worker.install(), /Public offline fallback unavailable/);
      assert.equal(worker.stored.length, 0);
    }
  });

  it("evicts a previously public asset when origin revokes cache permission or the asset disappears", async () => {
    const url = "https://sonaraindustries.com/sonara-one.js";
    for (const revocation of [
      { headers: { "cache-control": "private, no-store" } },
      { headers: { "cache-control": "public, max-age=300", "content-type": "text/html" } },
      { status: 401 },
      { status: 403 },
      { status: 404 },
      { status: 410 },
      { status: 451 },
      { redirected: true }
    ]) {
      const overrides = {};
      const worker = harness({ overrides });
      assert.equal(await worker.request("/sonara-one.js"), true);
      assert.ok(worker.active.has(url), "the public asset must exist before revocation");
      overrides["/sonara-one.js"] = revocation;
      assert.equal(await worker.request("/sonara-one.js"), true);
      assert.equal(worker.active.has(url), false, JSON.stringify(revocation));
      assert.deepEqual(worker.evicted, [url]);
      // Subsequent online fetches cannot see the obsolete public response.
      assert.equal(await worker.request("/sonara-one.js"), true);
      assert.equal(worker.active.has(url), false);
    }
  });

  it("preserves a valid public cache on transient errors without guessing that permissions changed", async () => {
    const overrides = {};
    const worker = harness({ overrides });
    const url = "https://sonaraindustries.com/sonara-one.js";
    await worker.request("/sonara-one.js");
    assert.ok(worker.active.has(url));
    for (const status of [206, 304, 429, 500, 503]) {
      overrides["/sonara-one.js"] = { status };
      assert.equal(await worker.request("/sonara-one.js"), true);
      assert.ok(worker.active.has(url), "transient " + status + " must not erase public asset");
    }
    assert.deepEqual(worker.evicted, []);
  });

  it("never caches private navigation; public navigation remains network-first", async () => {
    const worker = harness();
    assert.equal(await worker.request("/dashboard", { mode: "navigate" }), false);
    assert.equal(await worker.request("/business-builder/owner", { mode: "navigate" }), false);
    assert.equal(await worker.request("/pricing", { mode: "navigate" }), true);
    assert.equal(worker.networkRequests(), 1);
    assert.equal(worker.stored.length, 0);
  });
});
