// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function workerHarness() {
  const source = fs.readFileSync(require.resolve("../public/sw.js"), "utf8");
  const listeners = new Map();
  let activationsRequested = 0;
  const self = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    skipWaiting: () => { activationsRequested += 1; },
    location: { origin: "https://app.example" },
    clients: { claim: async () => {} }
  };
  const cache = {
    add: async () => {},
    match: async () => null,
    put: async () => {}
  };
  vm.runInNewContext(source, {
    self,
    URL, Request,
    Set,
    caches: {
      open: async () => cache,
      keys: async () => [],
      delete: async () => true,
      match: async () => null
    },
    fetch: async (request) => {
      const path = new URL(request.url).pathname;
      const types = {js:"text/javascript",css:"text/css",svg:"image/svg+xml",webmanifest:"application/manifest+json",woff2:"font/woff2"};
      return {ok:true,status:200,headers:new Headers({"cache-control":"public, max-age=0","content-type":path==="/offline"?"text/html":types[path.split(".").pop()]}),clone(){return this;}};
    }
  }, { filename: "sw.js" });
  return { listeners, getActivations: () => activationsRequested };
}

describe("PWA updates respect unsaved customer work", () => {
  it("does not forcibly activate while a new worker installs", async () => {
    const worker = workerHarness();
    let installation;
    worker.listeners.get("install")({ waitUntil: (promise) => { installation = promise; } });
    await installation;
    assert.equal(worker.getActivations(), 0);
  });

  it("activates only after an explicit SKIP_WAITING message", () => {
    const worker = workerHarness();
    worker.listeners.get("message")({ data: { type: "OTHER" } });
    worker.listeners.get("message")({ data: null });
    assert.equal(worker.getActivations(), 0);
    worker.listeners.get("message")({ data: { type: "SKIP_WAITING" } });
    assert.equal(worker.getActivations(), 1);
  });

  it("exposes a screen-reader-notice and an explicit update button", () => {
    const client = fs.readFileSync(require.resolve("../public/sonara-experience.js"), "utf8");
    assert.match(client, /aria-live/);
    assert.match(client, /Apply update/);
    assert.match(client, /button\.addEventListener\("click"/);
    assert.match(client, /waiting\.postMessage\(\{ type: "SKIP_WAITING" \}\)/);
  });

  it("warns before reloading a form and reloads only after worker control changes", () => {
    const client = fs.readFileSync(require.resolve("../public/sonara-experience.js"), "utf8");
    assert.match(client, /document\.querySelector\("form input/);
    assert.match(client, /window\.confirm\(/);
    assert.match(client, /"controllerchange"/);
    assert.match(client, /window\.location\.reload\(\)/);
    assert.equal((client.match(/window\.location\.reload\(\)/g) || []).length, 1);
  });

  it("checks for an existing waiting worker and avoids background polling loops", () => {
    const client = fs.readFileSync(require.resolve("../public/sonara-experience.js"), "utf8");
    assert.match(client, /showUpdateReady\(registration\)/);
    assert.match(client, /"visibilitychange"/);
    assert.match(client, /document\.visibilityState !== "visible"/);
    assert.match(client, /60 \* 60 \* 1000/);
  });
});
