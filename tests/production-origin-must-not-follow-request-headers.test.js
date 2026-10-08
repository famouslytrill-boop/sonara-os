// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { siteOrigin } = require("../lib/sonara-site-origin.cjs");

function withNodeEnv(environment, run) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = environment;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

const forgedRequest = {
  protocol: "https",
  get(name) {
    return {
      host: "attacker.example",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "https"
    }[name.toLowerCase()] || "";
  }
};

describe("canonical SONARA origin for all company products", () => {
  it("never builds production OAuth, checkout, invite, or share URLs from attacker-controlled host headers", () => {
    withNodeEnv("production", () => {
      assert.equal(siteOrigin(forgedRequest, () => ""), "");
      assert.equal(siteOrigin(forgedRequest, () => "http://sonaraindustries.com"), "");
      assert.equal(siteOrigin(forgedRequest, () => "https://sonaraindustries.com/"), "https://sonaraindustries.com");
      assert.equal(siteOrigin(forgedRequest, () => "https://sonaraindustries.com:443/"), "https://sonaraindustries.com");
    });
  });

  it("rejects malformed canonical URLs rather than putting credentials, paths, or redirects in external links", () => {
    withNodeEnv("production", () => {
      for (const bad of [
        "https://user:pass@sonaraindustries.com",
        "https://sonaraindustries.com/account",
        "https://sonaraindustries.com/?next=https://attacker.example",
        "https://sonaraindustries.com/#fragment",
        "javascript:alert(1)",
        "//attacker.example",
        "https://"
      ]) {
        assert.equal(siteOrigin(forgedRequest, () => bad), "", bad);
      }
    });
  });

  it("allows validated local-development hostnames without honoring forwarded hosts", () => {
    withNodeEnv("test", () => {
      const local = {
        protocol: "http",
        get(name) {
          return name === "host" ? "localhost:5000" : "attacker.example";
        }
      };
      assert.equal(siteOrigin(local, () => ""), "http://localhost:5000");
      assert.equal(siteOrigin({ ...local, protocol: "javascript" }, () => ""), "");
      assert.equal(siteOrigin({ ...local, get: () => "evil.example/path" }, () => ""), "");
      assert.equal(siteOrigin({ ...local, get: () => "evil.example@trusted.example" }, () => ""), "");
      assert.equal(siteOrigin({ ...local, get: () => "evil.example, trusted.example" }, () => ""), "");
    });
  });

  it("routes subscription and employee invite URL construction through the same helper", () => {
    const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
    const start = server.indexOf("function getPublicAppUrl(req) {");
    const end = server.indexOf("\nfunction getSafeAbsoluteUrl(", start);
    assert.ok(start >= 0 && end > start, "public URL factory is present");
    const factory = server.slice(start, end);
    assert.match(factory, /return siteOrigin\(req, \(\) => configured\)/);
    assert.doesNotMatch(factory, /x-forwarded-(?:host|proto)/i);
    assert.doesNotMatch(factory, /sonaraindustries\.com/);
  });
});
