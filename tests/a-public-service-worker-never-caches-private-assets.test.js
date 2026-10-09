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
        ...headers, ...(specific.headers || {})
      }),
      clone() { return this; }
    };
  }
  const cache = {
    match: async () => undefined,
    put: async (request) => { stored.push(typeof request === "string" ? new URL(request, "https://sonaraindustries.com").href : request.url); },
    add: async () => undefined
  };
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
      delete: async (name) => { removed.push(name); return true; }
    },
    fetch: async (target) => { networkRequests += 1; return makeResponse(target); },
    URL,
    Set,
    Promise
  };
  vm.runInNewContext(workerSource, context, { filename: "public/sw.js" });

  async function request(target, { mode = "cors", cacheMode = "default", requestHeaders = {} } = {}) {
    let handled;
    const waits = [];
    const event = {
      request: {
        url: new URL(target, context.self.location.origin).href,
        method: "GET",
        mode,
        cache: cacheMode,
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
  return { request, activate, install, stored, removed, networkRequests: () => networkRequests };
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
    assert.equal(worker.stored.length, 0);
    assert.equal(worker.networkRequests(), 0);
  });

  it("does not persist responses personalized by cookies, auth, or privacy directives", async () => {
    for (const scenario of [
      { headers: { "cache-control": "private, max-age=3600" } },
      { headers: { "cache-control": "no-store" } },
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

  it("precache never stores a login-page response as JavaScript", async () => {
    const worker = harness({ overrides: {
      "/sonara-one.js": { headers: { "content-type": "text/html" } },
      "/sonara-depth.js": { headers: { "set-cookie": "session=not-public" } }
    } });
    await worker.install();
    assert.ok(worker.stored.some((item) => item.endsWith("/offline")));
    assert.equal(worker.stored.some((item) => item.includes("/sonara-one.js")), false);
    assert.equal(worker.stored.some((item) => item.includes("/sonara-depth.js")), false);
    assert.ok(worker.stored.some((item) => item.includes("/sonara-application-ui.css")));
  });

  it("rejects an unsafe offline fallback instead of silently installing a personalized page", async () => {
    const worker = harness({ overrides: { "/offline": { headers: { "set-cookie": "private=1" } } } });
    await assert.rejects(() => worker.install(), /Public offline fallback unavailable/);
    assert.equal(worker.stored.length, 0);
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
