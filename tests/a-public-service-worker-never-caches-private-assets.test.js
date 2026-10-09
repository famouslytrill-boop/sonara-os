// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const workerSource = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");

function harness({ status = 200, headers = {}, type = "basic" } = {}) {
  const handlers = new Map();
  const stored = [];
  let networkRequests = 0;
  const response = {
    ok: status >= 200 && status < 300,
    status,
    type,
    headers: new Headers(headers),
    clone() { return this; }
  };
  const cache = {
    match: async () => undefined,
    put: async (request) => { stored.push(request.url); },
    add: async () => undefined
  };
  const context = {
    self: {
      location: { origin: "https://sonaraindustries.com" },
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: () => undefined
    },
    caches: { open: async () => cache, match: async () => undefined, keys: async () => [] },
    fetch: async () => { networkRequests += 1; return response; },
    URL,
    Set,
    Promise
  };
  vm.runInNewContext(workerSource, context, { filename: "public/sw.js" });

  async function request(target, { mode = "cors", cacheMode = "default", requestHeaders = {} } = {}) {
    let handled;
    const event = {
      request: {
        url: new URL(target, context.self.location.origin).href,
        method: "GET",
        mode,
        cache: cacheMode,
        headers: new Headers(requestHeaders)
      },
      respondWith: (promise) => { handled = promise; }
    };
    handlers.get("fetch")(event);
    if (handled) await handled;
    return Boolean(handled);
  }
  return { request, stored, networkRequests: () => networkRequests };
}

describe("PWA cache contains public assets only", () => {
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
      { type: "opaque" }
    ]) {
      const worker = harness(scenario);
      assert.equal(await worker.request("/sonara-one.js"), true);
      assert.equal(worker.networkRequests(), 1, JSON.stringify(scenario));
      assert.equal(worker.stored.length, 0, JSON.stringify(scenario));
    }
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
