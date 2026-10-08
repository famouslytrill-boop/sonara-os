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
  source + "\nself.__contract = { isPublicStaticRequest, isPublicNavigation, isCacheableResponse, VERSION, PUBLIC_STAGE };",
  { self: scope, URL }
);
const { isPublicStaticRequest, isPublicNavigation, isCacheableResponse, VERSION, PUBLIC_STAGE } = scope.__contract;
const allowed = (url) => isPublicStaticRequest(new URL(url, origin));

describe("cross-device service-worker cache boundary", () => {
  it("accepts the public release assets that it actually precaches", () => {
    for (const asset of PUBLIC_STAGE) {
      if (asset === "/offline") continue;
      assert.equal(allowed(asset), true, asset);
    }
    assert.equal(allowed("/icons/icon-192.png"), true);
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
      "/release/private/asset.png"
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

  it("rejects responses marked private, no-store or set-cookie", () => {
    function response(headers) {
      const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
      return { ok: true, type: "basic", headers: {
        get: (key) => lower[key.toLowerCase()] || null,
        has: (key) => Object.hasOwn(lower, key.toLowerCase())
      } };
    }
    assert.equal(isCacheableResponse(response({ "Cache-Control": "public, max-age=60" })), true);
    assert.equal(isCacheableResponse(response({ "Cache-Control": "private" })), false);
    assert.equal(isCacheableResponse(response({ "Cache-Control": "no-store" })), false);
    assert.equal(isCacheableResponse(response({ "Set-Cookie": "session=1" })), false);
  });
});
